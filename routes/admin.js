var express = require('express');
const productHelpers = require('../helpers/product-helpers');
const userHelpers = require('../helpers/user-help')
var router = express.Router();
const verifyLogin = (req, res, next) => {
  if (req.session.adminLogin) {
    next()
  } else {
    res.redirect('admin/login')

  }
}


router.get('/', verifyLogin, function (req, res, next) {
  let adminName = req.session.admin
  productHelpers.getAllProducts().then((products) => {
    res.render("admin/view-products", { admin: true, products, adminLogged: true, adminName })
  })
});

// The below commented code is for setting login details of the admin panel users.
//  Since admin panel should not be used simply by someone, a single login details is now given,
//  for adding more admin panel users you can uncomment the below code and run the signup page for admins
// (also uncomment the doSignup() function in productHelpers)

// router.get('/admin-signup', (req, res) => {
//   res.render('admin/admin-signup',{ admin: true})
// })
// router.post("/admin-signup", (req, res) => {
//   console.log("entered into admin page");
//   productHelpers.dosignup(req.body).then((response) => {
//     console.log(response)
//     req.session.admin=response
//     req.session.admin.loggedIN=true
//     res.redirect('/admin')

//   })
// })
router.get('/login', (req, res) => {
  if (req.session.admin) {
    res.redirect('/admin')
  } else {
    res.render('admin/login', { "loginErr": req.session.adminLoginErr, admin: true, adminLogged: false })
    req.session.adminLoginErr = false
  }
})
router.post("/login", (req, res) => {
  productHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.admin = response.admin
      req.session.adminLogin = true
      res.redirect('/admin')
    } else {
      req.session.adminLoginErr = "Invalid Username or Password"
      res.redirect('/admin/login')

    }
  })

})
router.get('/logout', (req, res) => {
  req.session.admin = null
  req.session.adminLogin = false
  res.redirect('/admin')
})
router.get('/add-product', verifyLogin, function (req, res) {
  res.render("admin/add-product", { admin: true })

})
router.post("/add-product", (req, res) => {
  productHelpers.addProduct(req.body, (id) => {

    let image = req.files.Image
    image.mv('./public/product-images/' + id + '.jpg', (err) => {
      if (!err) {
        res.render("admin/add-product",{admin:true})
      }
    })
  })
})
router.get('/delete-product/:id', (req, res) => {
  let proId = req.params.id
  productHelpers.deleteProduct(proId).then((respone) => {
    res.redirect('/admin')
  })
})
router.get('/edit-product/:id', verifyLogin, async (req, res) => {
  let product = await productHelpers.getProductDetails(req.params.id)
  console.log(product);
  res.render('admin/edit-product', { admin: true, product })
})
router.post('/edit-product/:id', (req, res) => {
  let id=req.params.id
  productHelpers.updateProduct(req.params.id, req.body).then(() => {
    res.redirect('/admin')
    if (req.files?.Image) {
      let image = req.files.Image
      image.mv('./public/product-images/' + id + '.jpg')
    }
  })
})
router.get('/all-orders', verifyLogin, async (req, res) => {
  console.log('>>>>Step1<<<<');
  let orders = await productHelpers.getOrder()
  console.log(orders);
  res.render('admin/all-orders', { admin: req.session.admin, admin: true, orders })
})


module.exports = router;
