using System.Net.Security;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;

namespace MikroTikPppManager.Api.Infrastructure;

public interface IMikroTikRouterOsClient
{
    Task<IReadOnlyList<Dictionary<string, string>>> ExecuteAsync(
        string command,
        IDictionary<string, string?>? parameters = null,
        CancellationToken cancellationToken = default);
}

public sealed class MikroTikRouterOsOptions
{
    public string RouterDisplayName { get; set; } = "Core-BNG-CCR2116-01";
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 8729;
    public string Username { get; set; } = "ppp-api-admin";
    public string Password { get; set; } = string.Empty;
    public bool TlsEnabled { get; set; } = true;
    public bool ValidateCertificate { get; set; } = true;
    public int TimeoutMs { get; set; } = 8000;
}

/// <summary>
/// Secure C# Binary MikroTik RouterOS API & API-SSL Client (Ports 8728 / 8729).
/// Enforces a strict whitelist of PPP-related commands and validates TLS server certificates by default.
/// </summary>
public sealed class MikroTikRouterOsClient : IMikroTikRouterOsClient
{
    private static readonly HashSet<string> AllowedCommands = new(StringComparer.Ordinal)
    {
        "/login",
        "/system/identity/print",
        "/system/resource/print",
        "/ppp/secret/print",
        "/ppp/secret/add",
        "/ppp/secret/set",
        "/ppp/secret/remove",
        "/ppp/secret/enable",
        "/ppp/secret/disable",
        "/ppp/profile/print",
        "/ppp/profile/add",
        "/ppp/profile/set",
        "/ppp/profile/remove",
        "/ppp/active/print",
        "/ppp/active/remove"
    };

    private readonly MikroTikRouterOsOptions _options;

    public MikroTikRouterOsClient(MikroTikRouterOsOptions options)
    {
        _options = options;
    }

    public async Task<IReadOnlyList<Dictionary<string, string>>> ExecuteAsync(
        string command,
        IDictionary<string, string?>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        if (!AllowedCommands.Contains(command))
        {
            throw new InvalidOperationException($"Security policy violation: RouterOS command '{command}' is not permitted.");
        }

        if (string.IsNullOrWhiteSpace(_options.Host))
        {
            throw new InvalidOperationException("MikroTik RouterOS hostname or IP address is not configured.");
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(Math.Clamp(_options.TimeoutMs, 1000, 30000));

        using var tcpClient = new TcpClient();
        await tcpClient.ConnectAsync(_options.Host, _options.Port, cts.Token);

        Stream transportStream = tcpClient.GetStream();
        if (_options.TlsEnabled)
        {
            var sslStream = new SslStream(
                transportStream,
                leaveInnerStreamOpen: false,
                userCertificateValidationCallback: (_, certificate, chain, sslPolicyErrors) =>
                {
                    if (!_options.ValidateCertificate)
                    {
                        return true;
                    }
                    return sslPolicyErrors == SslPolicyErrors.None && certificate is not null && chain is not null;
                });

            var sslOptions = new SslClientAuthenticationOptions
            {
                TargetHost = _options.Host,
                EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
                CertificateRevocationCheckMode = X509RevocationMode.Online
            };

            await sslStream.AuthenticateAsClientAsync(sslOptions, cts.Token);
            transportStream = sslStream;
        }

        await AuthenticateSessionAsync(transportStream, cts.Token);

        var words = new List<string> { command };
        if (parameters is not null)
        {
            foreach (var kvp in parameters)
            {
                if (kvp.Value is not null)
                {
                    words.Add($"={kvp.Key}={kvp.Value}");
                }
            }
        }

        await WriteSentenceAsync(transportStream, words, cts.Token);
        var sentences = await ReadSentencesUntilDoneAsync(transportStream, cts.Token);

        var trap = sentences.FirstOrDefault(s => s.Tag is "!trap" or "!fatal");
        if (trap is not null)
        {
            var msg = trap.Attributes.TryGetValue("message", out var m) ? m : "RouterOS command failed.";
            throw new InvalidOperationException($"RouterOS API error: {msg}");
        }

        return sentences
            .Where(s => s.Tag == "!re")
            .Select(s => s.Attributes)
            .ToList();
    }

    private async Task AuthenticateSessionAsync(Stream stream, CancellationToken ct)
    {
        var loginWords = new List<string>
        {
            "/login",
            $"=name={_options.Username}",
            $"=password={_options.Password}"
        };

        await WriteSentenceAsync(stream, loginWords, ct);
        var reply = await ReadSentencesUntilDoneAsync(stream, ct);

        var trap = reply.FirstOrDefault(s => s.Tag is "!trap" or "!fatal");
        if (trap is not null)
        {
            var msg = trap.Attributes.TryGetValue("message", out var m) ? m : "RouterOS authentication failed.";
            throw new UnauthorizedAccessException(msg);
        }

        var done = reply.FirstOrDefault(s => s.Tag == "!done");
        if (done is not null && done.Attributes.TryGetValue("ret", out var challengeHex) && !string.IsNullOrEmpty(challengeHex))
        {
            // RouterOS pre-6.43 MD5 challenge-response fallback
            var challengeBytes = Convert.FromHexString(challengeHex);
            var passwordBytes = Encoding.UTF8.GetBytes(_options.Password);
            var payload = new byte[1 + passwordBytes.Length + challengeBytes.Length];
            payload[0] = 0x00;
            Buffer.BlockCopy(passwordBytes, 0, payload, 1, passwordBytes.Length);
            Buffer.BlockCopy(challengeBytes, 0, payload, 1 + passwordBytes.Length, challengeBytes.Length);

            var hashHex = Convert.ToHexString(MD5.HashData(payload)).ToLowerInvariant();
            await WriteSentenceAsync(stream, new[]
            {
                "/login",
                $"=name={_options.Username}",
                $"=response=00{hashHex}"
            }, ct);

            var chapReply = await ReadSentencesUntilDoneAsync(stream, ct);
            if (chapReply.Any(s => s.Tag is "!trap" or "!fatal"))
            {
                throw new UnauthorizedAccessException("Legacy RouterOS CHAP authentication rejected.");
            }
        }
    }

    private static async Task WriteSentenceAsync(Stream stream, IEnumerable<string> words, CancellationToken ct)
    {
        using var ms = new MemoryStream();
        foreach (var word in words)
        {
            var bytes = Encoding.UTF8.GetBytes(word);
            WriteLengthPrefix(ms, bytes.Length);
            ms.Write(bytes, 0, bytes.Length);
        }
        ms.WriteByte(0x00); // Zero-length word terminates sentence
        var buffer = ms.ToArray();
        await stream.WriteAsync(buffer, ct);
        await stream.FlushAsync(ct);
    }

    private static void WriteLengthPrefix(Stream s, int len)
    {
        if (len < 0x80)
        {
            s.WriteByte((byte)len);
        }
        else if (len < 0x4000)
        {
            var v = len | 0x8000;
            s.WriteByte((byte)((v >> 8) & 0xFF));
            s.WriteByte((byte)(v & 0xFF));
        }
        else if (len < 0x200000)
        {
            var v = len | 0xC00000;
            s.WriteByte((byte)((v >> 16) & 0xFF));
            s.WriteByte((byte)((v >> 8) & 0xFF));
            s.WriteByte((byte)(v & 0xFF));
        }
        else if (len < 0x10000000)
        {
            var v = len | 0xE0000000;
            s.WriteByte((byte)((v >> 24) & 0xFF));
            s.WriteByte((byte)((v >> 16) & 0xFF));
            s.WriteByte((byte)((v >> 8) & 0xFF));
            s.WriteByte((byte)(v & 0xFF));
        }
        else
        {
            s.WriteByte(0xF0);
            s.WriteByte((byte)((len >> 24) & 0xFF));
            s.WriteByte((byte)((len >> 16) & 0xFF));
            s.WriteByte((byte)((len >> 8) & 0xFF));
            s.WriteByte((byte)(len & 0xFF));
        }
    }

    private sealed record ParsedSentence(string Tag, Dictionary<string, string> Attributes);

    private static async Task<List<ParsedSentence>> ReadSentencesUntilDoneAsync(Stream stream, CancellationToken ct)
    {
        var sentences = new List<ParsedSentence>();
        while (true)
        {
            var words = new List<string>();
            while (true)
            {
                var word = await ReadWordAsync(stream, ct);
                if (word.Length == 0)
                {
                    break;
                }
                words.Add(word);
            }

            if (words.Count == 0)
            {
                continue;
            }

            var tag = words[0];
            var attrs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 1; i < words.Count; i++)
            {
                var w = words[i];
                if (w.StartsWith('='))
                {
                    var idx = w.IndexOf('=', 1);
                    if (idx > 1)
                    {
                        attrs[w[1..idx]] = w[(idx + 1)..];
                    }
                }
            }

            sentences.Add(new ParsedSentence(tag, attrs));
            if (tag is "!done" or "!fatal")
            {
                break;
            }
        }
        return sentences;
    }

    private static async Task<string> ReadWordAsync(Stream stream, CancellationToken ct)
    {
        var b0 = await ReadSingleByteAsync(stream, ct);
        int length;

        if ((b0 & 0x80) == 0x00)
        {
            length = b0;
        }
        else if ((b0 & 0xC0) == 0x80)
        {
            var b1 = await ReadSingleByteAsync(stream, ct);
            length = ((b0 & 0x3F) << 8) | b1;
        }
        else if ((b0 & 0xE0) == 0xC0)
        {
            var b1 = await ReadSingleByteAsync(stream, ct);
            var b2 = await ReadSingleByteAsync(stream, ct);
            length = ((b0 & 0x1F) << 16) | (b1 << 8) | b2;
        }
        else if ((b0 & 0xF0) == 0xE0)
        {
            var b1 = await ReadSingleByteAsync(stream, ct);
            var b2 = await ReadSingleByteAsync(stream, ct);
            var b3 = await ReadSingleByteAsync(stream, ct);
            length = ((b0 & 0x0F) << 24) | (b1 << 16) | (b2 << 8) | b3;
        }
        else
        {
            var b1 = await ReadSingleByteAsync(stream, ct);
            var b2 = await ReadSingleByteAsync(stream, ct);
            var b3 = await ReadSingleByteAsync(stream, ct);
            var b4 = await ReadSingleByteAsync(stream, ct);
            length = (b1 << 24) | (b2 << 16) | (b3 << 8) | b4;
        }

        if (length == 0)
        {
            return string.Empty;
        }

        var buffer = new byte[length];
        var readTotal = 0;
        while (readTotal < length)
        {
            var r = await stream.ReadAsync(buffer.AsMemory(readTotal, length - readTotal), ct);
            if (r == 0)
            {
                throw new EndOfStreamException("RouterOS stream closed while reading word payload.");
            }
            readTotal += r;
        }
        return Encoding.UTF8.GetString(buffer);
    }

    private static async Task<int> ReadSingleByteAsync(Stream stream, CancellationToken ct)
    {
        var one = new byte[1];
        var r = await stream.ReadAsync(one.AsMemory(0, 1), ct);
        if (r == 0)
        {
            throw new EndOfStreamException("RouterOS stream closed unexpectedly.");
        }
        return one[0];
    }
}
