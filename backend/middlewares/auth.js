import { error } from "node:console";
import { AppError } from "../errors/apperr.js";

export const authMiddleware = (req, res, next) => {
    try{
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ code: 401, message: "Access denied. No token provided." });
        }

        const {remote_token, token_without_bearer} = extractToken(token, "both");
        req.remote_token = remote_token
        req.token_without_bearer = token_without_bearer

    } catch(err){
        if (err instanceof AppError){
            return res.status(err.code).json({code: err.code, error: err.message})
        }
        return res.status(400).json({code: 400, error: "An error has ocurred"})

    }
    
    next();
}

export const guestMiddleware = (req, res, next) => {
    try{
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ code: 401, message: "Access denied. No token provided." });
        }

        const {remote_token, token_without_bearer} = extractToken(token, "guest");
        req.remote_token = remote_token
        req.token_without_bearer = token_without_bearer

    } catch(err){
        if (err instanceof AppError){
            return res.status(err.code).json({code: err.code, error: err.message})
        }
        console.log(err instanceof AppError)

        return res.status(400).json({code: 400, error: "An error has ocurred"})

    }
    next();
}

export const managerMiddleware = (req, res, next) => {
    try{
        const token = req.headers.authorization;
        if (!token) {
            return res.status(401).json({ code: 401, message: "Access denied. No token provided." });
        }

        const {remote_token, token_without_bearer} = extractToken(token, "manager");
        req.remote_token = remote_token
        req.token_without_bearer = token_without_bearer

    } catch(err){
        if (err instanceof AppError){
            return res.status(err.code).json({code: err.code, error: err.message})
        }
        
        return res.status(400).json({code: 400, error: "An error has ocurred"})

    }
    next();
}

function extractToken(rawToken, role) {

    const token_without_bearer = rawToken.split(" ")[1]

    if (role !== "both"){
        if(token_without_bearer.split("-")[0] !== role){
            throw error({ code: 403, message: "Access denied", error: `Role not valid: ${token_without_bearer.split("_")[0]}`})
        }
    }

    const token_env = token_without_bearer.split('-').map(part => part.trim().toUpperCase()).join('_');
    const remote_token = process.env['RESERVATIONS_' + token_env + '_TOKEN'];
    
    if (!remote_token || remote_token === undefined) {
        throw AppError({ code: 401, message: "Access denied", error: `Token not found in env: ${remote_token}`})
    }

    return {
        remote_token: remote_token,
        token_without_bearer: token_without_bearer
    }
}
