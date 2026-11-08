using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using MikroTikPppManager.Api.Infrastructure;
using MikroTikPppManager.Api.Models;

namespace MikroTikPppManager.Api.Services;

public sealed class PppAdministrationService
{
    private readonly object _configLock = new();
    private MikroTikRouterOsOptions _liveOptions;
    private readonly ConcurrentQueue<AuditLogEntryDto> _auditLogs = new();
    private int _auditSequence = 9100;

    public PppAdministrationService(IConfiguration configuration)
    {
        _liveOptions = new MikroTikRouterOsOptions
        {
            RouterDisplayName = configuration["MikroTik:RouterDisplayName"] ?? "Core-BNG-CCR2116-01",
            Host = configuration["MikroTik:Host"] ?? string.Empty,
            Port = int.TryParse(configuration["MikroTik:Port"], out var p) ? p : 8729,
            Username = configuration["MikroTik:Username"] ?? "ppp-api-admin",
            Password = configuration["MikroTik:Password"] ?? string.Empty,
            TlsEnabled = !bool.TryParse(configuration["MikroTik:TlsEnabled"], out var tls) || tls,
            ValidateCertificate = !bool.TryParse(configuration["MikroTik:ValidateCertificate"], out var vc) || vc,
            TimeoutMs = int.TryParse(configuration["MikroTik:TimeoutMs"], out var tm) ? tm : 8000
        };
    }

    public void RecordAudit(
        string action,
        string target,
        string details,
        string mode = "live",
        string result = "SUCCESS",
        string? errorMessage = null,
        string administrator = "netops.admin")
    {
        // Zero-plaintext password policy
        var sanitized = Regex.Replace(details, @"password\s*[:=]\s*\S+", "password=[REDACTED]", RegexOptions.IgnoreCase);
        var entry = new AuditLogEntryDto(
            Id: $"AUD-{Interlocked.Increment(ref _auditSequence)}",
            Timestamp: DateTime.UtcNow.ToString("O"),
            Administrator: administrator,
            Action: action,
            Target: target,
            Details: sanitized,
            Result: result,
            ErrorMessage: errorMessage,
            Mode: mode
        );
        _auditLogs.Enqueue(entry);
        while (_auditLogs.Count > 250)
        {
            _auditLogs.TryDequeue(out _);
        }
    }

    public IReadOnlyList<AuditLogEntryDto> GetAuditLogs() =>
        _auditLogs.Reverse().ToList();

    public object GetRouterConfigSafe()
    {
        lock (_configLock)
        {
            return new
            {
                routerDisplayName = _liveOptions.RouterDisplayName,
                host = _liveOptions.Host,
                port = _liveOptions.Port,
                username = _liveOptions.Username,
                tlsEnabled = _liveOptions.TlsEnabled,
                validateCertificate = _liveOptions.ValidateCertificate,
                timeoutMs = _liveOptions.TimeoutMs,
                hasPasswordConfigured = !string.IsNullOrEmpty(_liveOptions.Password)
            };
        }
    }

    public object UpdateRouterConfig(RouterConnectionConfigRequest req)
    {
        lock (_configLock)
        {
            _liveOptions = new MikroTikRouterOsOptions
            {
                RouterDisplayName = req.RouterDisplayName.Trim(),
                Host = req.Host.Trim(),
                Port = req.Port,
                Username = req.Username.Trim(),
                Password = !string.IsNullOrWhiteSpace(req.Password) ? req.Password : _liveOptions.Password,
                TlsEnabled = req.TlsEnabled,
                ValidateCertificate = req.ValidateCertificate,
                TimeoutMs = req.TimeoutMs
            };
        }

        RecordAudit(
            "ROUTER_CONFIG_UPDATED",
            $"{req.Host}:{req.Port}",
            $"Updated RouterOS endpoint (TLS={req.TlsEnabled}, ValidateCertificate={req.ValidateCertificate})");

        return GetRouterConfigSafe();
    }

    private IMikroTikRouterOsClient CreateClient(MikroTikRouterOsOptions? overrideOptions = null)
    {
        MikroTikRouterOsOptions opts;
        lock (_configLock)
        {
            opts = overrideOptions ?? _liveOptions;
        }
        return new MikroTikRouterOsClient(opts);
    }

    public async Task<RouterInfoDto> GetRouterInfoAsync(
        RouterConnectionConfigRequest? overrideReq = null,
        CancellationToken ct = default)
    {
        MikroTikRouterOsOptions opts;
        lock (_configLock)
        {
            opts = overrideReq is null
                ? _liveOptions
                : new MikroTikRouterOsOptions
                {
                    RouterDisplayName = overrideReq.RouterDisplayName,
                    Host = overrideReq.Host,
                    Port = overrideReq.Port,
                    Username = overrideReq.Username,
                    Password = !string.IsNullOrWhiteSpace(overrideReq.Password) ? overrideReq.Password : _liveOptions.Password,
                    TlsEnabled = overrideReq.TlsEnabled,
                    ValidateCertificate = overrideReq.ValidateCertificate,
                    TimeoutMs = overrideReq.TimeoutMs
                };
        }

        try
        {
            var client = CreateClient(opts);
            var identityRows = await client.ExecuteAsync("/system/identity/print", null, ct);
            var resourceRows = await client.ExecuteAsync("/system/resource/print", null, ct);

            var identity = identityRows.FirstOrDefault()?.GetValueOrDefault("name") ?? opts.RouterDisplayName;
            var res = resourceRows.FirstOrDefault() ?? new Dictionary<string, string>();

            return new RouterInfoDto(
                Connected: true,
                Mode: "live",
                RouterDisplayName: opts.RouterDisplayName,
                Identity: identity,
                Version: res.GetValueOrDefault("version") ?? "RouterOS",
                BoardName: res.GetValueOrDefault("board-name") ?? "MikroTik",
                ArchitectureName: res.GetValueOrDefault("architecture-name") ?? "unknown",
                Uptime: res.GetValueOrDefault("uptime") ?? "0s",
                CpuLoad: int.TryParse(res.GetValueOrDefault("cpu-load"), out var cpu) ? cpu : 0,
                FreeMemoryBytes: long.TryParse(res.GetValueOrDefault("free-memory"), out var fm) ? fm : 0,
                TotalMemoryBytes: long.TryParse(res.GetValueOrDefault("total-memory"), out var tm) ? tm : 0,
                Host: opts.Host,
                Port: opts.Port,
                TlsEnabled: opts.TlsEnabled,
                ValidateCertificate: opts.ValidateCertificate,
                LastCheckedAt: DateTime.UtcNow.ToString("O"),
                ErrorMessage: null
            );
        }
        catch (Exception ex)
        {
            return new RouterInfoDto(
                Connected: false,
                Mode: "live",
                RouterDisplayName: opts.RouterDisplayName,
                Identity: "Unreachable",
                Version: "—",
                BoardName: "—",
                ArchitectureName: "—",
                Uptime: "—",
                CpuLoad: 0,
                FreeMemoryBytes: 0,
                TotalMemoryBytes: 0,
                Host: opts.Host,
                Port: opts.Port,
                TlsEnabled: opts.TlsEnabled,
                ValidateCertificate: opts.ValidateCertificate,
                LastCheckedAt: DateTime.UtcNow.ToString("O"),
                ErrorMessage: ex.Message
            );
        }
    }

    public async Task<IReadOnlyList<PppUserDto>> GetUsersAsync(CancellationToken ct = default)
    {
        var client = CreateClient();
        var secrets = await client.ExecuteAsync("/ppp/secret/print", null, ct);
        var active = await client.ExecuteAsync("/ppp/active/print", null, ct);

        var activeByName = active
            .Where(a => a.ContainsKey("name"))
            .ToDictionary(a => a["name"], a => a, StringComparer.OrdinalIgnoreCase);

        return secrets.Select(sec =>
        {
            var name = sec.GetValueOrDefault("name") ?? string.Empty;
            activeByName.TryGetValue(name, out var act);
            var uptime = act?.GetValueOrDefault("uptime");

            return new PppUserDto(
                Id: sec.GetValueOrDefault(".id") ?? name,
                Name: name,
                Service: sec.GetValueOrDefault("service") ?? "any",
                Profile: sec.GetValueOrDefault("profile") ?? "default",
                LocalAddress: sec.GetValueOrDefault("local-address") ?? string.Empty,
                RemoteAddress: sec.GetValueOrDefault("remote-address") ?? string.Empty,
                CallerId: sec.GetValueOrDefault("caller-id") ?? string.Empty,
                Routes: sec.GetValueOrDefault("routes") ?? string.Empty,
                LimitBytesIn: long.TryParse(sec.GetValueOrDefault("limit-bytes-in"), out var lbi) ? lbi : 0,
                LimitBytesOut: long.TryParse(sec.GetValueOrDefault("limit-bytes-out"), out var lbo) ? lbo : 0,
                Comment: sec.GetValueOrDefault("comment") ?? string.Empty,
                Disabled: sec.GetValueOrDefault("disabled") is "true" or "yes",
                LastLoggedOut: sec.GetValueOrDefault("last-logged-out"),
                IsOnline: act is not null,
                ActiveIp: act?.GetValueOrDefault("address"),
                Uptime: uptime,
                UptimeSeconds: 0,
                ActiveSessionId: act?.GetValueOrDefault("session-id") ?? act?.GetValueOrDefault(".id"),
                ActiveRowId: act?.GetValueOrDefault(".id"),
                ActiveCallerId: act?.GetValueOrDefault("caller-id"),
                ActiveEncoding: act?.GetValueOrDefault("encoding")
            );
        }).ToList();
    }
}
