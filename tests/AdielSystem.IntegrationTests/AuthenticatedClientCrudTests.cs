using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Clients;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedClientCrudTests
{
    [Fact]
    public async Task Owner_can_complete_client_crud_archive_restore_and_timeline_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var cancellationToken = TestContext.Current.CancellationToken;

        var baseline = await client.GetAsync("/api/v1/clients?page=1&pageSize=12&sort=name", cancellationToken);
        Assert.True(baseline.IsSuccessStatusCode, await baseline.Content.ReadAsStringAsync(cancellationToken));
        var leakedTestRecords = await client.GetFromJsonAsync<ClientPageDto>("/api/v1/clients?search=Integration%20Client&includeArchived=true&page=1&pageSize=100", cancellationToken);
        Assert.DoesNotContain(leakedTestRecords!.Items, item => item.Name.StartsWith("Integration Client ", StringComparison.Ordinal));

        var industries = await client.GetFromJsonAsync<ClientIndustryDto[]>("/api/v1/clients/industries", cancellationToken);
        Assert.Contains(industries!, option => option.IsActive);
        var industry = industries!.First(option => option.IsActive);
        var uniqueName = $"Integration Client {Guid.NewGuid():N}";
        var contactId = Guid.NewGuid();

        var create = await client.PostAsJsonAsync("/api/v1/clients", new
        {
            name = uniqueName,
            photo = (string?)null,
            address = "Integration Test Address",
            industry = industry.Name,
            clientSince = "2026-08-24",
            status = "Active",
            contacts = new[] { new { id = contactId, name = "Test Owner", email = "owner@example.com", phone = "+63 900 000 0000" } },
        }, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<ClientDto>(cancellationToken);
        Assert.NotNull(created);

        var page = await client.GetFromJsonAsync<ClientPageDto>($"/api/v1/clients?search={Uri.EscapeDataString(uniqueName)}&page=1&pageSize=12&sort=name", cancellationToken);
        Assert.Contains(page!.Items, entry => entry.Id == created.Id);

        var update = await client.PutAsJsonAsync($"/api/v1/clients/{created.Id}", new
        {
            name = uniqueName,
            photo = (string?)null,
            address = "Updated Integration Address",
            industry = industry.Name,
            clientSince = "2026-08-24",
            status = "Inactive",
            version = created.Version,
            contacts = new[] { new { id = contactId, name = "Test Owner", email = "updated@example.com", phone = "+63 900 000 0001" } },
        }, cancellationToken);
        update.EnsureSuccessStatusCode();
        var updated = await update.Content.ReadFromJsonAsync<ClientDto>(cancellationToken);
        Assert.Equal("Updated Integration Address", updated!.Address);

        var archive = await client.PostAsJsonAsync($"/api/v1/clients/{updated.Id}/archive", new { version = updated.Version }, cancellationToken);
        archive.EnsureSuccessStatusCode();
        var archived = await archive.Content.ReadFromJsonAsync<ClientDto>(cancellationToken);
        Assert.NotNull(archived!.ArchivedAt);

        var archivedPage = await client.GetFromJsonAsync<ClientPageDto>($"/api/v1/clients?archivedOnly=true&search={Uri.EscapeDataString(uniqueName)}&page=1&pageSize=12", cancellationToken);
        Assert.Contains(archivedPage!.Items, entry => entry.Id == archived.Id);

        var restore = await client.PostAsJsonAsync($"/api/v1/clients/{archived.Id}/restore", new { version = archived.Version }, cancellationToken);
        restore.EnsureSuccessStatusCode();
        var restored = await restore.Content.ReadFromJsonAsync<ClientDto>(cancellationToken);
        Assert.Null(restored!.ArchivedAt);

        var timeline = await client.GetFromJsonAsync<ClientTimelineDto>($"/api/v1/clients/{restored.Id}/timeline", cancellationToken);
        Assert.Contains(timeline!.Items, entry => entry.Kind == "Activity" && entry.Title.Contains("Client", StringComparison.OrdinalIgnoreCase));
        // OwnerApiFactory rolls back Client, contact, and audit writes on disposal.
    }
}
