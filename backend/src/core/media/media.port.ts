/** Core owns storage and processing. Organization IDs come from verified membership. */
export interface ReadyMedia {
  id: string;
  organizationId: string;
  status: 'READY';
  mimeType: string;
  width: number;
  height: number;
}
/**
 * Planned Core adapter boundary. No implementation/upload route exists yet.
 * Implementations must check ownership and READY status, mask foreign IDs as
 * not found, and revalidate under the transaction that attaches the reference.
 * Clients cannot declare an upload READY or supply a trusted storage URL.
 */
export interface MediaAttachmentPort {
  requireReady(organizationId: string, mediaIds: readonly string[]): Promise<ReadyMedia[]>;
}
