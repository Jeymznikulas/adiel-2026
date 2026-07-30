namespace AdielSystem.Api.Endpoints;

public static class SystemEndpoints
{
    public static RouteGroupBuilder MapSystemEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/system", () => TypedResults.Ok(new SystemResponse(
            Name: "Adiel System API",
            Version: "v1",
            UtcTime: DateTimeOffset.UtcNow)))
            .WithName("GetSystemInformation")
            .Produces<SystemResponse>();

        return group;
    }

    private sealed record SystemResponse(string Name, string Version, DateTimeOffset UtcTime);
}

