$(function (){

	var user = window.user = {}

	user.putIntoCollection = function(url, eID){
		return window.api.ajax("POST", url, { entryId: eID })
	}

	// Logout user when logout button is clicked
    function logout(evt) {
		evt.preventDefault()
        api.v1.account.logout().done(ok => window.location = "/")
    }
	
    function loggedIn() {
		$("#logout").click(logout)

        $("#logout").text("logout").attr("href", "/")
        $("#profile").text("profile").attr("href", "/profile.html")
    }

	// TODO: Get a somewhat better solution that doesn't flicker
	//#logout is the id for both login/signup + logout
	api.v1.account.loggedIn().done(loggedIn)
})
