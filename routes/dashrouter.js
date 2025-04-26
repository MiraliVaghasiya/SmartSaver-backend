const ensureAuthenticated = require("../middlewares/auth");

const router = require("express").Router();

router.get('/' ,ensureAuthenticated,(req,res)=>{
    console.log("---login user name ---" ,  req.user.email)
    res.status(200).json({ message: "done" })
});

module.exports = router