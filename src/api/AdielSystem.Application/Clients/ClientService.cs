using AdielSystem.Application.Common;
using AdielSystem.Application.Security;
using AdielSystem.Domain.Clients;

namespace AdielSystem.Application.Clients;

public sealed class ClientService(IClientRepository repository, ICurrentUserAccessor currentUserAccessor)
{
    private static readonly string[] SortValues = ["name", "newest", "industry"];

    public async Task<ClientPageDto> ListAsync(
        string? search,
        string? industry,
        bool includeArchived,
        bool archivedOnly,
        int page,
        int pageSize,
        string? sort,
        CancellationToken cancellationToken)
    {
        if (includeArchived && archivedOnly) throw new RequestValidationException("Choose either all Clients or archived Clients, not both.");
        if (page <= 0) throw new RequestValidationException("Page must be greater than zero.");
        if (pageSize is < 1 or > 100) throw new RequestValidationException("Page size must be between 1 and 100.");
        var normalizedSort = string.IsNullOrWhiteSpace(sort) ? "name" : sort.Trim().ToLowerInvariant();
        if (!SortValues.Contains(normalizedSort)) throw new RequestValidationException("Client sort must be name, newest, or industry.");
        var criteria = new ClientSearchCriteria(search?.Trim() ?? string.Empty, string.IsNullOrWhiteSpace(industry) ? null : industry.Trim(), includeArchived, archivedOnly, page, pageSize, normalizedSort);
        var result = await repository.SearchAsync(criteria, cancellationToken);
        var summary = new ClientDirectorySummaryDto(result.Summary.TotalClients, result.Summary.ActiveClients, result.Summary.IndustryCount, result.Summary.ApprovedSalesValue);
        return new ClientPageDto(result.Items.Select(ToDto).ToArray(), page, pageSize, result.Total, summary);
    }

    public async Task<ClientDto> GetAsync(Guid id, CancellationToken cancellationToken) => ToDto(await GetRequiredAsync(id, cancellationToken));

    public async Task<ClientTimelineDto> GetTimelineAsync(Guid id, CancellationToken cancellationToken)
    {
        await GetRequiredAsync(id, cancellationToken);
        var entries = await repository.ListTimelineAsync(id, cancellationToken);
        var items = entries.Select(entry => new ClientTimelineEntryDto(entry.Id, entry.Kind, entry.Source, entry.OccurredAt, entry.Reference, entry.Title, entry.Description, entry.Amount, entry.Balance, entry.Status, entry.Href)).ToArray();
        var statements = entries.Where(entry => entry.Kind == "SOA" && entry.Status != "Cancelled").ToArray();
        var summary = new ClientTimelineSummaryDto(
            entries.Where(entry => entry.Kind == "Sale").Sum(entry => entry.Amount ?? 0),
            entries.Where(entry => entry.Kind == "Payment").Sum(entry => entry.Amount ?? 0),
            statements.Sum(entry => entry.Balance ?? 0),
            entries.Count,
            statements.Count(entry => (entry.Balance ?? 0) > 0),
            entries.Count(entry => entry.Kind == "Payment"));
        return new ClientTimelineDto(items, summary);
    }

    public async Task<IReadOnlyList<ClientIndustryDto>> ListIndustriesAsync(CancellationToken cancellationToken) =>
        (await repository.ListIndustriesAsync(cancellationToken)).Select(ToDto).ToArray();

    public async Task<ClientIndustryDto> CreateIndustryAsync(CreateClientIndustryRequest request, CancellationToken cancellationToken)
    {
        var name = RequiredOptionName(request.Name);
        return ToDto(await repository.CreateIndustryAsync(name, cancellationToken));
    }

    public async Task<ClientIndustryDto> RenameIndustryAsync(Guid id, RenameClientIndustryRequest request, CancellationToken cancellationToken)
    {
        if (request.Version <= 0) throw new RequestValidationException("The current industry version is required.");
        return ToDto(await repository.RenameIndustryAsync(id, RequiredOptionName(request.Name), request.Version, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ClientIndustryDto> SetIndustryActiveAsync(Guid id, SetClientIndustryActiveRequest request, CancellationToken cancellationToken)
    {
        if (request.Version <= 0) throw new RequestValidationException("The current industry version is required.");
        return ToDto(await repository.SetIndustryActiveAsync(id, request.IsActive, request.Version, cancellationToken));
    }

    public async Task<IReadOnlyList<ClientIndustryDto>> ReorderIndustriesAsync(ReorderClientIndustriesRequest request, CancellationToken cancellationToken)
    {
        if (request.Ids is null || request.Ids.Count == 0 || request.Ids.Distinct().Count() != request.Ids.Count)
            throw new RequestValidationException("Provide each industry exactly once in the desired order.");
        return (await repository.ReorderIndustriesAsync(request.Ids, cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task DeleteIndustryAsync(Guid id, long version, CancellationToken cancellationToken)
    {
        if (version <= 0) throw new RequestValidationException("The current industry version is required.");
        await repository.DeleteIndustryAsync(id, version, cancellationToken);
    }

    public async Task<ClientDto> CreateAsync(SaveClientRequest request, CancellationToken cancellationToken)
    {
        var industry = RequiredOptionName(request.Industry);
        await RequireActiveIndustryAsync(industry, cancellationToken);
        var client = Client.Create(Guid.NewGuid(), request.Name, request.Photo, request.Address, industry, request.ClientSince, ParseStatus(request.Status), CreateContacts(request.Contacts));
        return ToDto(await repository.CreateAsync(client, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ClientDto> UpdateAsync(Guid id, SaveClientRequest request, CancellationToken cancellationToken)
    {
        if (request.Version is null or <= 0) throw new RequestValidationException("The current client version is required when saving changes.");
        var client = await GetRequiredAsync(id, cancellationToken);
        var industry = RequiredOptionName(request.Industry);
        if (!string.Equals(client.Industry, industry, StringComparison.OrdinalIgnoreCase))
            await RequireActiveIndustryAsync(industry, cancellationToken);
        client.Update(request.Name, request.Photo, request.Address, industry, request.ClientSince, ParseStatus(request.Status), CreateContacts(request.Contacts));
        return ToDto(await repository.UpdateAsync(client, request.Version.Value, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ClientDto> ArchiveAsync(Guid id, long version, CancellationToken cancellationToken)
    {
        if (version <= 0) throw new RequestValidationException("The current client version is required.");
        var client = await GetRequiredAsync(id, cancellationToken);
        client.Archive(DateTimeOffset.UtcNow);
        return ToDto(await repository.SetArchivedAsync(client, version, true, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    public async Task<ClientDto> RestoreAsync(Guid id, long version, CancellationToken cancellationToken)
    {
        if (version <= 0) throw new RequestValidationException("The current client version is required.");
        var client = await GetRequiredAsync(id, cancellationToken);
        client.Restore();
        return ToDto(await repository.SetArchivedAsync(client, version, false, currentUserAccessor.GetRequiredUser(), cancellationToken));
    }

    private async Task<Client> GetRequiredAsync(Guid id, CancellationToken cancellationToken) =>
        await repository.GetAsync(id, cancellationToken) ?? throw new ResourceNotFoundException($"Client '{id}' was not found.");

    private async Task RequireActiveIndustryAsync(string? industry, CancellationToken cancellationToken)
    {
        var name = RequiredOptionName(industry);
        if (!await repository.IsActiveIndustryAsync(name, cancellationToken))
            throw new RequestValidationException("Choose an active Client industry.");
    }

    private static string RequiredOptionName(string? value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.Length is < 1 or > 60) throw new RequestValidationException("Industry names must be between 1 and 60 characters.");
        return normalized;
    }

    private static ClientStatus ParseStatus(string status) =>
        Enum.TryParse<ClientStatus>(status, true, out var parsed) ? parsed : throw new RequestValidationException("Client status must be Active or Inactive.");

    private static IReadOnlyList<ClientContact> CreateContacts(IReadOnlyList<ClientContactRequest>? contacts)
    {
        if (contacts is null || contacts.Count == 0) throw new RequestValidationException("At least one contact person is required.");
        try
        {
            return contacts.Select((contact, index) => ClientContact.Create(contact.Id is null || contact.Id == Guid.Empty ? Guid.NewGuid() : contact.Id.Value, contact.Name, contact.Email, contact.Phone, index == 0, index)).ToArray();
        }
        catch (ArgumentException exception)
        {
            throw new RequestValidationException(exception.Message);
        }
    }

    private static ClientDto ToDto(Client client)
    {
        var primary = client.Contacts.First(contact => contact.IsPrimary);
        return new ClientDto(client.Id, client.PhotoPath ?? string.Empty, client.Name, primary.Name, primary.Email, primary.Phone, client.Address, client.Industry, client.ClientSince, client.Status.ToString(), client.Contacts.Select(contact => new ClientContactDto(contact.Id, contact.Name, contact.Email, contact.Phone, contact.IsPrimary, contact.SortOrder)).ToArray(), client.CreatedAt, client.UpdatedAt, client.ArchivedAt, client.Version);
    }

    private static ClientIndustryDto ToDto(ClientIndustry option) =>
        new(option.Id, option.Name, option.IsActive, option.SortOrder, option.UsageCount, option.Version);
}
