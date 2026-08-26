namespace AdielSystem.Infrastructure.Storage;

public sealed class SupabaseStorageOptions
{
    public const string SectionName = "Supabase:Storage";
    public string ServiceRoleKey { get; init; } = string.Empty;
    public string Bucket { get; init; } = "business-images";
    public bool EnsureBucketOnStartup { get; init; } = true;
}
