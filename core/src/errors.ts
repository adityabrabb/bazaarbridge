// -----------------------------------------------------------------------
// errors.ts
// Purpose: an error that carries the HTTP status the API should answer
//          with, so services can say "404" or "409" without knowing HTTP.
// -----------------------------------------------------------------------

export const HTTP_BAD_REQUEST = 400;
export const HTTP_NOT_FOUND = 404;
export const HTTP_CONFLICT = 409;
export const HTTP_BAD_GATEWAY = 502;

export class ServiceError extends Error {
   status: number;

   // --------------------------------------------------------------------
   // constructor
   // Purpose: message for the client + HTTP status code.
   // --------------------------------------------------------------------
   constructor(status: number, message: string) {
      super(message);
      this.name = "ServiceError";
      this.status = status;
   }
}
