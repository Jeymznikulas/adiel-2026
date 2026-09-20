using AdielSystem.Api.Security;
using AdielSystem.Application.Backups;
using AdielSystem.Application.Common;

namespace AdielSystem.Api.Endpoints;

public static class DatabaseBackupEndpoints
{
    public static RouteGroupBuilder MapDatabaseBackupEndpoints(this RouteGroupBuilder group)
    {
        var backups = group.MapGroup("/settings/backups")
            .WithTags("Database Backups")
            .RequireRateLimiting(SecurityConstants.OwnerRateLimitPolicy);

        backups.MapGet(string.Empty, async (DatabaseBackupService service, CancellationToken token) =>
                Results.Ok(await service.ListAsync(token)))
            .WithName("ListDatabaseBackups")
            .Produces<IReadOnlyList<DatabaseBackupSummaryDto>>();

        backups.MapPost(string.Empty, async (DatabaseBackupService service, CancellationToken token) =>
            {
                var backup = await service.CreateAsync(token);
                return Results.File(backup.Content, "application/zip", backup.Summary.FileName, enableRangeProcessing: false, lastModified: backup.Summary.CreatedAt);
            })
            .WithName("CreateDatabaseBackup")
            .Produces(StatusCodes.Status200OK, contentType: "application/zip")
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithRequestTimeout(TimeSpan.FromMinutes(5));

        backups.MapGet("/{id:guid}/download", async (Guid id, DatabaseBackupService service, CancellationToken token) =>
            {
                var backup = await service.GetAsync(id, token);
                return Results.File(backup.Content, "application/zip", backup.Summary.FileName, enableRangeProcessing: false, lastModified: backup.Summary.CreatedAt);
            })
            .WithName("DownloadStoredDatabaseBackup")
            .Produces(StatusCodes.Status200OK, contentType: "application/zip")
            .ProducesProblem(StatusCodes.Status404NotFound);

        backups.MapPost("/validate", async (HttpRequest request, DatabaseBackupService service, CancellationToken token) =>
            {
                var upload = await ReadUploadAsync(request, token);
                return Results.Ok(await service.ValidateAsync(upload.Content, upload.FileName, token));
            })
            .WithName("ValidateDatabaseBackup")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<DatabaseBackupPreviewDto>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithRequestTimeout(TimeSpan.FromMinutes(3))
            .DisableAntiforgery();

        backups.MapPost("/restore", async (HttpRequest request, DatabaseBackupService service, CancellationToken token) =>
            {
                var form = await request.ReadFormAsync(token);
                var upload = await ReadUploadAsync(form, token);
                return Results.Ok(await service.RestoreAsync(upload.Content, upload.FileName, form["confirmation"].ToString(), token));
            })
            .WithName("RestoreDatabaseBackup")
            .Accepts<IFormFile>("multipart/form-data")
            .Produces<DatabaseRestoreResultDto>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .WithRequestTimeout(TimeSpan.FromMinutes(10))
            .DisableAntiforgery();

        return group;
    }

    private static async Task<UploadedBackup> ReadUploadAsync(HttpRequest request, CancellationToken cancellationToken)
    {
        if (!request.HasFormContentType) throw new RequestValidationException("Upload the database backup as multipart form data.");
        return await ReadUploadAsync(await request.ReadFormAsync(cancellationToken), cancellationToken);
    }

    private static async Task<UploadedBackup> ReadUploadAsync(IFormCollection form, CancellationToken cancellationToken)
    {
        var file = form.Files.GetFile("file") ?? throw new RequestValidationException("Choose a database backup ZIP file.");
        if (file.Length <= 0) throw new RequestValidationException("The selected database backup is empty.");
        if (file.Length > DatabaseBackupService.MaximumUploadBytes) throw new RequestValidationException("The database backup exceeds the 60 MB upload limit.");
        using var output = new MemoryStream((int)file.Length);
        await file.CopyToAsync(output, cancellationToken);
        return new UploadedBackup(file.FileName, output.ToArray());
    }

    private sealed record UploadedBackup(string FileName, byte[] Content);
}
