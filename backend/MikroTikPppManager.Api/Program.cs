using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics;
using MikroTikPppManager.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new()
    {
        Title = "MikroTik PPP Manager API (.NET 10)",
        Version = "v1",
        Description = "Production REST API for managing MikroTik RouterOS /ppp/secret, /ppp/profile, and /ppp/active over TLS (Port 8729)."
    });
});

// Register MikroTik PPP Administration Service as Singleton
builder.Services.AddSingleton<PppAdministrationService>();

// Configure sliding-window API rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "local",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 240,
                Window = TimeSpan.FromMinutes(1)
            }));
});

var app = builder.Build();

// Safe global exception handler that never leaks raw MikroTik credentials or internal stack traces
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var feature = context.Features.Get<IExceptionHandlerFeature>();
        context.Response.StatusCode = StatusCodes.Status502BadGateway;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            error = feature?.Error.Message ?? "An unexpected RouterOS communication error occurred."
        });
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

app.Run();
