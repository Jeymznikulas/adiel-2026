using AdielSystem.Application.Security;
using AdielSystem.Domain.Items;

namespace AdielSystem.Application.Items;

public interface IItemRepository
{
    Task<ItemSearchResult> SearchAsync(ItemSearchCriteria criteria, CancellationToken cancellationToken);
    Task<Item?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> AreActiveCategoriesAsync(IReadOnlyList<string> categories, CancellationToken cancellationToken);
    Task<Item> CreateAsync(Item item, CurrentUser actor, CancellationToken cancellationToken);
    Task<Item> UpdateAsync(Item item, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<Item> SetArchivedAsync(Item item, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken);
    Task<Item> CreateVariantAsync(Guid itemId, SaveItemVariantRequest request, CurrentUser actor, CancellationToken cancellationToken);
    Task<Item> UpdateVariantAsync(Guid itemId, Guid variantId, SaveItemVariantRequest request, CurrentUser actor, CancellationToken cancellationToken);
    Task<Item> DeleteVariantAsync(Guid itemId, Guid variantId, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<Item> AddPriceAdjustmentAsync(Guid itemId, AddPriceAdjustmentRequest request, CurrentUser actor, CancellationToken cancellationToken);
}

public sealed record ItemSearchCriteria(string Search, string? SupplierId, string? Category, string? Status, bool IncludeArchived, bool ArchivedOnly, int Page, int PageSize, string Sort);
public sealed record ItemDirectorySummary(long TotalItems, long ActiveItems, long CategoryCount, decimal AverageMargin);
public sealed record ItemSearchResult(IReadOnlyList<Item> Items, long Total, ItemDirectorySummary Summary);
