export class AppError extends Error {
    constructor(code, publicError, error) {
        super(error);

        this.code = code;
        this.publicError = publicError;
        this.error = error;
    }
}