using Microsoft.AspNetCore.Mvc;
using MikroTikPppManager.Api.Infrastructure;
using MikroTikPppManager.Api.Models;
using MikroTikPppManager.Api.Services;

namespace MikroTikPppManager.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class PppControllers : ControllerBase
{
    private readonly PppAdministrationService _service;

    public PppControllers(PppAdministrationService service)
    {
        _service = service;
    }

    [HttpGet("router/info")]
    public async Task<ActionResult<RouterInfoDto>> GetRouterInfo(CancellationToken ct)
    {
        var info = await _service.GetRouterInfoAsync(null, ct);
        return Ok(info);
    }

    [HttpGet("router/config")]
    public IActionResult GetRouterConfig() => Ok(_service.GetRouterConfigSafe());

    [HttpPut("router/config")]
    public IActionResult UpdateRouterConfig([FromBody] RouterConnectionConfigRequest request) =>
        Ok(_service.UpdateRouterConfig(request));

    [HttpPost("router/test-connection")]
    public async Task<ActionResult<RouterInfoDto>> TestConnection(
        [FromBody] RouterConnectionConfigRequest request,
        CancellationToken ct)
    {
        var info = await _service.GetRouterInfoAsync(request, ct);
        _service.RecordAudit(
            "ROUTER_CONNECTION_TESTED",
            $"{request.Host}:{request.Port}",
            info.Connected ? $"Connected to {info.Identity} ({info.Version})" : $"Failed: {info.ErrorMessage}",
            "live",
            info.Connected ? "SUCCESS" : "FAILURE",
            info.ErrorMessage);
        return Ok(info);
    }

    [HttpGet("ppp/users")]
    public async Task<ActionResult<IReadOnlyList<PppUserDto>>> GetUsers(CancellationToken ct)
    {
        var users = await _service.GetUsersAsync(ct);
        return Ok(users);
    }

    [HttpGet("ppp/users/{id}")]
    public async Task<ActionResult<PppUserDto>> GetUserById(string id, CancellationToken ct)
    {
        var users = await _service.GetUsersAsync(ct);
        var match = users.FirstOrDefault(u => u.Id == id || u.Name == id);
        return match is null ? NotFound(new { error = "PPP secret not found." }) : Ok(match);
    }

    [HttpGet("logs")]
    public ActionResult<IReadOnlyList<AuditLogEntryDto>> GetLogs() =>
        Ok(_service.GetAuditLogs());
}
