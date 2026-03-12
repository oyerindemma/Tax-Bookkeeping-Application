import "server-only";

type Metadata = Record<string, unknown> | undefined;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

function formatMessage(scope: string, message: string) {
  return `[TaxBook:${scope}] ${message}`;
}

export function logInfo(scope: string, message: string, metadata?: Metadata) {
  if (metadata) {
    console.info(formatMessage(scope, message), metadata);
    return;
  }
  console.info(formatMessage(scope, message));
}

export function logWarn(scope: string, message: string, metadata?: Metadata) {
  if (metadata) {
    console.warn(formatMessage(scope, message), metadata);
    return;
  }
  console.warn(formatMessage(scope, message));
}

export function logError(scope: string, message: string, error: unknown, metadata?: Metadata) {
  const payload = {
    ...(metadata ?? {}),
    error: serializeError(error),
  };
  console.error(formatMessage(scope, message), payload);
}

export function logRouteError(route: string, error: unknown, metadata?: Metadata) {
  logError("route", route, error, metadata);
}
