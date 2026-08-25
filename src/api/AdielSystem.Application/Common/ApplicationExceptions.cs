namespace AdielSystem.Application.Common;

public sealed class RequestValidationException(string message) : Exception(message);
public sealed class ResourceNotFoundException(string message) : Exception(message);
public sealed class ResourceConflictException(string message) : Exception(message);
public sealed class ConcurrencyConflictException(string message) : Exception(message);
