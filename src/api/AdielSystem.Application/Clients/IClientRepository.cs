using AdielSystem.Application.Security;
using AdielSystem.Domain.Clients;

namespace AdielSystem.Application.Clients;

public interface IClientRepository
{
    Task<ClientSearchResult> SearchAsync(ClientSearchCriteria criteria, CancellationToken cancellationToken);
    Task<Client?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClientTimelineEntry>> ListTimelineAsync(Guid id, CancellationToken cancellationToken);
    Task<bool> IsActiveIndustryAsync(string name, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClientIndustry>> ListIndustriesAsync(CancellationToken cancellationToken);
    Task<ClientIndustry> CreateIndustryAsync(string name, CancellationToken cancellationToken);
    Task<ClientIndustry> RenameIndustryAsync(Guid id, string name, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<ClientIndustry> SetIndustryActiveAsync(Guid id, bool isActive, long expectedVersion, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClientIndustry>> ReorderIndustriesAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken);
    Task DeleteIndustryAsync(Guid id, long expectedVersion, CancellationToken cancellationToken);
    Task<Client> CreateAsync(Client client, CurrentUser actor, CancellationToken cancellationToken);
    Task<Client> UpdateAsync(Client client, long expectedVersion, CurrentUser actor, CancellationToken cancellationToken);
    Task<Client> SetArchivedAsync(Client client, long expectedVersion, bool archived, CurrentUser actor, CancellationToken cancellationToken);
}

public sealed record ClientSearchCriteria(string Search, string? Industry, bool IncludeArchived, bool ArchivedOnly, int Page, int PageSize, string Sort);
public sealed record ClientDirectorySummary(long TotalClients, long ActiveClients, long IndustryCount, decimal ApprovedSalesValue);
public sealed record ClientSearchResult(IReadOnlyList<Client> Items, long Total, ClientDirectorySummary Summary);
public sealed record ClientTimelineEntry(Guid Id, string Kind, string Source, DateTimeOffset OccurredAt, string Reference, string Title, string Description, decimal? Amount, decimal? Balance, string Status, string Href);
public sealed record ClientIndustry(Guid Id, string Name, bool IsActive, int SortOrder, long UsageCount, long Version);
