export interface PinLocation {
  addedAt: string; // ISO 8601 timestamp
  address: string;
  additionalInfo: string;
  lat: number;
  lng: number;
  reported: number;
  imageUrl: string;
  imagePath: string;
}

// export interface ExpectedData {
//   addedAt: string;
//   address: string;
//   additionalInfo: string;
//   imageUrl: string;
//   imagePath: string;
// }

/**
 * Represents the incoming request object for a Firebase v2 Callable Function.
 */
export interface FirebaseCallableRequest<TData = unknown> {
  /**
   * The parsed data sent by the client.
   * Always under the "data" key in the JSON body.
   */
  data: TData;

  /**
   * The raw Node.js IncomingMessage object.
   * Includes headers, method, IP, etc.
   */
  rawRequest?: {
    /** Original HTTP headers from the client */
    headers: Record<string, string | string[] | undefined>;

    /** IP address of the client, if available */
    ip?: string;

    /** HTTP method (e.g., "POST") */
    method?: string;

    /** The original URL of the request */
    url?: string;

    /** The parsed body, if available */
    body?: unknown;
  };

  /**
   * Whether this function supports streaming responses (rare for onCall).
   */
  acceptsStreaming?: boolean;

  /**
   * Authentication context (if provided by Firebase Auth)
   */
  auth?: {
    uid: string;
    token: Record<string, any>;
  } | null;

  /**
   * App Check token information (if enforceAppCheck is enabled)
   */
  app?: {
    appId: string;
  } | null;
}
