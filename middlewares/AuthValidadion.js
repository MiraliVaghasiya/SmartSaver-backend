const joi = require('joi');

const signupValidation = (req, res, next) => {
    const schema   = joi.object({
        name :joi.string().min(3).max(100).required(),
        email : joi.string().email().required(),
        password: joi.string().min(4).max(10).required().messages({
            'string.min': 'Password too short, minimum 4 characters', 
            'string.max': 'Password too long, maximum 10 characters', 
            'any.required': 'Password is required', 
        }),
    });
    const {error }=  schema.validate(req.body);
    if(error) {
        return res.status(400).json({message : "Bad request" , error})
    }
    next();
}

const loginValidation = (req, res, next) => {
    const schema   = joi.object({
        email : joi.string().email().required(),
        password: joi.string().min(4).max(10).required().messages({
        'string.min': 'Password too short, minimum 4 characters', 
        'string.max': 'Password too long, maximum 10 characters', 
        'any.required': 'Password is required', 
      }),
    });
    const {error }=  schema.validate(req.body);
    if(error) {
        return res.status(400).json({message : "Bad request" , error})
    }
    next();
}

module.exports={
    signupValidation,
    loginValidation
}