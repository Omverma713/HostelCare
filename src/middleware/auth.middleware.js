const jwt = require("jsonwebtoken");
const authMiddleware = async (req, res, next) => {
       try {
        const authHeader = req.headers.authorization;
       if(authHeader==null){
        return res.status(401).json({
            success:false,
            message:"Authorization header missing"
        })
       }
       const token = authHeader.split(' ')[1];
       if(token==null){
        return   res.status(401).json({
            success:false,
            message:"Token missing"
        })
       }
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       req.user = decoded;
       next();
       } catch (error) {
         return res.status(401).json({
            success: false,
            message: "Failed to authenticate user",
            error: error.message
        })
       }
}

module.exports = authMiddleware;