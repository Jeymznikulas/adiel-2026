using AdielSystem.Application.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace AdielSystem.Api;

internal sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            RequestValidationException or ArgumentException => (400, "Invalid request", exception.Message),
            ResourceNotFoundException => (404, "Resource not found", exception.Message),
            ResourceConflictException => (409, "Resource conflict", exception.Message),
            ConcurrencyConflictException => (409, "The record has changed", exception.Message),
            UnauthorizedAccessException => (401, "Authentication required", "A valid owner session is required."),
            _ => (500, "Unexpected server error", "The server could not complete the request."),
        };
        if (status >= 500) logger.LogError(exception, "Unhandled API error. Trace ID: {TraceId}", context.TraceIdentifier);
        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail, Instance = context.Request.Path };
        problem.Extensions["traceId"] = context.TraceIdentifier;
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
