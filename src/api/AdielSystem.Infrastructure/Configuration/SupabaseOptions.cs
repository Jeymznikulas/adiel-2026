namespace AdielSystem.Infrastructure.Configuration;

public sealed class SupabaseOptions
{
    public const string SectionName = "Supabase";

    public required Uri Url { get; init; }

    public required string ServiceRoleKey { get; init; }
}

