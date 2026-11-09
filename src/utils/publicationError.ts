import type { SharedDriverRow } from './sharedDriver';

export class PublicationError extends Error {
  constructor(public kind: 'retryable' | 'invalid_session' | 'conflict' | 'invalid_request', public row?: SharedDriverRow) {
    super(kind);
  }
}
