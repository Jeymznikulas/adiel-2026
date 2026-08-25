using AdielSystem.Application.Security;
using AdielSystem.Domain.Suppliers;

namespace AdielSystem.Application.Suppliers;

public interface ISupplierRepository
{
    Task<SupplierSearchResult> SearchAsync(SupplierSearchCriteria criteria, CancellationToken cancellationToken);
    Task<Supplier?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> AreActiveCategoriesAsync(IReadOnlyList<string> categories, CancellationToken cancellationToken);
    Task<Supplier> CreateAsync(Supplier supplier, CurrentUser actor, CancellationToken cancellationToken);
    Task<Supplier> UpdateAsync(Supplier supplier, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<Supplier> SetArchivedAsync(Supplier supplier, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken);
}

public sealed record SupplierSearchCriteria(string Search, string? Type, bool IncludeArchived, bool ArchivedOnly, int Page, int PageSize, string Sort);
public sealed record SupplierDirectorySummary(long TotalSuppliers, long ActiveSuppliers, long CategoryCount);
public sealed record SupplierSearchResult(IReadOnlyList<Supplier> Items, long Total, SupplierDirectorySummary Summary);
