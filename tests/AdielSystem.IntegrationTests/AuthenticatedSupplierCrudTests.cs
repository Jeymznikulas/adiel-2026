using System.Net;
using System.Net.Http.Json;
using AdielSystem.Application.Suppliers;
using AdielSystem.Application.Settings;

namespace AdielSystem.IntegrationTests;

public sealed class AuthenticatedSupplierCrudTests
{
    [Fact]
    public async Task Owner_can_complete_supplier_crud_archive_and_restore_against_database()
    {
        await using var factory = new OwnerApiFactory();
        using var client = factory.CreateClient();
        var token = TestContext.Current.CancellationToken;
        var baseline = await client.GetAsync("/api/v1/suppliers?page=1&pageSize=100&sort=name", token);
        Assert.True(baseline.IsSuccessStatusCode, await baseline.Content.ReadAsStringAsync(token));
        var leaked = await client.GetFromJsonAsync<SupplierPageDto>("/api/v1/suppliers?search=Integration%20Supplier&includeArchived=true&page=1&pageSize=100", token);
        Assert.DoesNotContain(leaked!.Items, supplier => supplier.Name.StartsWith("Integration Supplier ", StringComparison.Ordinal));
        var categories = await client.GetFromJsonAsync<BusinessOptionDto[]>("/api/v1/settings/options?type=supplier_category", token);
        var category = categories!.First(option => option.IsActive);
        var uniqueName = $"Integration Supplier {Guid.NewGuid():N}";
        var contactId = Guid.NewGuid();
        var noteId = Guid.NewGuid();

        var create = await client.PostAsJsonAsync("/api/v1/suppliers", new
        {
            name = uniqueName,
            logo = (string?)null,
            type = "Distributor",
            status = "Active",
            tin = "123-456-789",
            companyEmail = "sales@example.com",
            companyPhone = "+63 900 000 0000",
            address = "Integration Test Address",
            catalogUrl = "https://example.com/catalog",
            contacts = new[] { new { id = contactId, name = "Test Owner", email = "owner@example.com", phone = "+63 900 000 0001" } },
            categories = new[] { category.Name },
            performanceNotes = new[] { new { id = noteId, text = "Reliable delivery." } },
        }, token);
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<SupplierDto>(token);
        Assert.NotNull(created);
        Assert.Single(created.Contacts);
        Assert.Single(created.PerformanceNotes);

        var update = await client.PutAsJsonAsync($"/api/v1/suppliers/{created.Id}", new
        {
            name = uniqueName,
            logo = (string?)null,
            type = "Distributor",
            status = "Inactive",
            tin = "123-456-789",
            companyEmail = "updated@example.com",
            companyPhone = "+63 900 000 0002",
            address = "Updated Integration Address",
            catalogUrl = "https://example.com/catalog",
            contacts = new[] { new { id = contactId, name = "Test Owner", email = "updated@example.com", phone = "+63 900 000 0003" } },
            categories = new[] { category.Name },
            performanceNotes = new[] { new { id = noteId, text = "Updated performance note." } },
            version = created.Version,
        }, token);
        update.EnsureSuccessStatusCode();
        var updated = await update.Content.ReadFromJsonAsync<SupplierDto>(token);
        Assert.Equal("Updated Integration Address", updated!.Address);
        Assert.Equal("Updated performance note.", updated.PerformanceNotes.Single().Text);

        var archive = await client.PostAsJsonAsync($"/api/v1/suppliers/{updated.Id}/archive", new { version = updated.Version }, token);
        archive.EnsureSuccessStatusCode();
        var archived = await archive.Content.ReadFromJsonAsync<SupplierDto>(token);
        Assert.NotNull(archived!.ArchivedAt);

        var archivedPage = await client.GetFromJsonAsync<SupplierPageDto>($"/api/v1/suppliers?archivedOnly=true&search={Uri.EscapeDataString(uniqueName)}&page=1&pageSize=100", token);
        Assert.Contains(archivedPage!.Items, supplier => supplier.Id == archived.Id);

        var restore = await client.PostAsJsonAsync($"/api/v1/suppliers/{archived.Id}/restore", new { version = archived.Version }, token);
        restore.EnsureSuccessStatusCode();
        var restored = await restore.Content.ReadFromJsonAsync<SupplierDto>(token);
        Assert.Null(restored!.ArchivedAt);
        // OwnerApiFactory rolls Supplier, child, and audit writes back on disposal.
    }
}
