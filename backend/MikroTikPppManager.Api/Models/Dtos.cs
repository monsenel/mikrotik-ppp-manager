using System.ComponentModel.DataAnnotations;

namespace MikroTikPppManager.Api.Models;

public record PppUserDto(
    string Id,
    string Name,
    string Service,
    string Profile,
    string LocalAddress,
    string RemoteAddress,
    string CallerId,
    string Routes,
    long LimitBytesIn,
    long LimitBytesOut,
    string Comment,
    bool Disabled,
    string? LastLoggedOut,
    bool IsOnline,
    string? ActiveIp,
    string? Uptime,
    long UptimeSeconds,
    string? ActiveSessionId,
    string? ActiveRowId,
    string? ActiveCallerId,
    string? ActiveEncoding
);

public class CreateOrUpdatePppUserRequest
{
    [Required, MinLength(1), MaxLength(64)]
    [RegularExpression(@"^[a-zA-Z0-9._@-]+$", ErrorMessage = "Username contains invalid characters.")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? Password { get; set; }

    [Required]
    [RegularExpression(@"^(any|pppoe|pptp|l2tp|ovpn|sstp)$")]
    public string Service { get; set; } = "any";

    [Required, MaxLength(64)]
    public string Profile { get; set; } = "default";

    [MaxLength(64)]
    public string? LocalAddress { get; set; }

    [MaxLength(64)]
    public string? RemoteAddress { get; set; }

    [MaxLength(64)]
    public string? CallerId { get; set; }

    [MaxLength(256)]
    public string? Routes { get; set; }

    [Range(0, long.MaxValue)]
    public long LimitBytesIn { get; set; }

    [Range(0, long.MaxValue)]
    public long LimitBytesOut { get; set; }

    [MaxLength(255)]
    public string? Comment { get; set; }

    public bool Disabled { get; set; }
}

public class BulkUserActionRequest
{
    [Required]
    public List<string> Ids { get; set; } = new();

    [Required]
    [RegularExpression(@"^(enable|disable|delete|assign-profile)$")]
    public string Action { get; set; } = string.Empty;

    [MaxLength(64)]
    public string? Profile { get; set; }
}

public record PppProfileDto(
    string Id,
    string Name,
    string LocalAddress,
    string RemoteAddress,
    string RateLimit,
    string SessionTimeout,
    string IdleTimeout,
    string OnlyOne,
    string UseEncryption,
    string DnsServer,
    string ChangeTcpMss,
    string Comment,
    bool IsDefaultBuiltIn,
    int AssignedUserCount,
    IReadOnlyList<string> AssignedUsers
);

public class CreateOrUpdatePppProfileRequest
{
    [Required, MinLength(1), MaxLength(64)]
    [RegularExpression(@"^[a-zA-Z0-9._-]+$")]
    public string Name { get; set; } = string.Empty;

    [MaxLength(64)]
    public string? LocalAddress { get; set; }

    [MaxLength(64)]
    public string? RemoteAddress { get; set; }

    [MaxLength(128)]
    public string? RateLimit { get; set; }

    [MaxLength(64)]
    public string? SessionTimeout { get; set; }

    [MaxLength(64)]
    public string? IdleTimeout { get; set; }

    [RegularExpression(@"^(default|yes|no)$")]
    public string OnlyOne { get; set; } = "default";

    [RegularExpression(@"^(default|yes|no|required)$")]
    public string UseEncryption { get; set; } = "default";

    [MaxLength(128)]
    public string? DnsServer { get; set; }

    [RegularExpression(@"^(default|yes|no)$")]
    public string ChangeTcpMss { get; set; } = "default";

    [MaxLength(255)]
    public string? Comment { get; set; }
}

public record PppActiveSessionDto(
    string Id,
    string Name,
    string Service,
    string CallerId,
    string Address,
    string Uptime,
    long UptimeSeconds,
    string SessionId,
    string Encoding,
    long LimitBytesIn,
    long LimitBytesOut,
    string? RelatedSecretId,
    string? Profile
);

public class RouterConnectionConfigRequest
{
    [Required, MaxLength(64)]
    public string RouterDisplayName { get; set; } = "Core-BNG-CCR2116-01";

    [MaxLength(128)]
    public string Host { get; set; } = string.Empty;

    [Range(1, 65535)]
    public int Port { get; set; } = 8729;

    [Required, MaxLength(64)]
    public string Username { get; set; } = "ppp-api-admin";

    [MaxLength(128)]
    public string? Password { get; set; }

    public bool TlsEnabled { get; set; } = true;
    public bool ValidateCertificate { get; set; } = true;

    [Range(1000, 30000)]
    public int TimeoutMs { get; set; } = 8000;
}

public record RouterInfoDto(
    bool Connected,
    string Mode,
    string RouterDisplayName,
    string Identity,
    string Version,
    string BoardName,
    string ArchitectureName,
    string Uptime,
    int CpuLoad,
    long FreeMemoryBytes,
    long TotalMemoryBytes,
    string Host,
    int Port,
    bool TlsEnabled,
    bool ValidateCertificate,
    string LastCheckedAt,
    string? ErrorMessage
);

public record AuditLogEntryDto(
    string Id,
    string Timestamp,
    string Administrator,
    string Action,
    string Target,
    string Details,
    string Result,
    string? ErrorMessage,
    string Mode
);

public record ServiceBreakdownItem(string Service, int Total, int Online);
public record ProfileBreakdownItem(string Profile, int Count, int OnlineCount);

public record DashboardSummaryDto(
    int TotalUsers,
    int EnabledUsers,
    int DisabledUsers,
    int OnlineUsers,
    int OfflineUsers,
    int TotalProfiles,
    RouterInfoDto RouterInfo,
    IReadOnlyList<AuditLogEntryDto> RecentActions,
    IReadOnlyList<PppActiveSessionDto> RecentSessions,
    IReadOnlyList<PppActiveSessionDto> TopSessionsByUptime,
    IReadOnlyList<ServiceBreakdownItem> ServiceBreakdown,
    IReadOnlyList<ProfileBreakdownItem> ProfileBreakdown
);
