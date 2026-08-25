using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Application.Suppliers;
using AdielSystem.Domain.Suppliers;

namespace AdielSystem.UnitTests.Suppliers;

public sealed class SupplierServiceTests
{
    [Fact]
    public async Task Create_supplier_normalizes_contacts_and_uses_the_current_owner()
    {
        var repository = new FakeSupplierRepository();
        var service = new SupplierService(repository, new FakeCurrentUser());

        var saved = await service.CreateAsync(new("  Test Supply  ", null, "Distributor", "Active", "123", "sales@example.com", "123", "", null, [new(null, "  Jane  ", "jane@example.com", "456")], ["Electrical"], [new(null, "  Reliable delivery  ")]), TestContext.Current.CancellationToken);

        Assert.Equal("Test Supply", saved.Name);
        Assert.True(saved.Contacts.Single().IsPrimary);
        Assert.Equal("owner", repository.LastActor?.Username);
    }

    [Fact]
    public async Task Supplier_categories_must_be_active()
    {
        var repository = new FakeSupplierRepository { CategoriesAreActive = false };
        var service = new SupplierService(repository, new FakeCurrentUser());

        await Assert.ThrowsAsync<RequestValidationException>(() => service.CreateAsync(new("Test Supply", null, "Distributor", "Active", "123", "sales@example.com", "123", "", null, [new(null, "Jane", "jane@example.com", "456")], ["Unknown"], []), TestContext.Current.CancellationToken));
    }

    private sealed class FakeCurrentUser : ICurrentUserAccessor { public CurrentUser GetRequiredUser() => new(Guid.Parse("11111111-1111-1111-1111-111111111111"), "owner"); }
    private sealed class FakeSupplierRepository : ISupplierRepository
    {
        public bool CategoriesAreActive { get; set; } = true;
        public CurrentUser? LastActor { get; private set; }
        public Task<SupplierSearchResult> SearchAsync(SupplierSearchCriteria criteria, CancellationToken cancellationToken) => Task.FromResult(new SupplierSearchResult([], 0, new SupplierDirectorySummary(0, 0, 0)));
        public Task<Supplier?> GetAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult<Supplier?>(null);
        public Task<bool> AreActiveCategoriesAsync(IReadOnlyList<string> categories, CancellationToken cancellationToken) => Task.FromResult(CategoriesAreActive);
        public Task<Supplier> CreateAsync(Supplier supplier, CurrentUser actor, CancellationToken cancellationToken) { LastActor = actor; return Task.FromResult(supplier); }
        public Task<Supplier> UpdateAsync(Supplier supplier, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken) => Task.FromResult(supplier);
        public Task<Supplier> SetArchivedAsync(Supplier supplier, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken) => Task.FromResult(supplier);
    }
}
