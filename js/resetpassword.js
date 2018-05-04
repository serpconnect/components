$(document).ready(function() {
    $("#login").addClass("current-view");

    function el(elementType) {
        return $(document.createElement(elementType));
    }

    function clearComplaints() {
        $(".complaint").remove()
    }

    function complainSomeMore(where, what) {
        $(where).append(el("div").addClass("complaint").text(what));
    }

    window.api.ajax("GET", window.api.host + "/v1/account/login")
    .done(ok => window.location = "/profile.html")

    $("#confirm-btn").on("click", function(evt) {
        if($("#password").val() === $("#password2").val()){
          var req = window.api.v1.account.confirmNewPassword($("#password").val())

          req.done(xhr => window.location = "profile.html")

          req.fail(xhr => {
              complainSomeMore("#password2-wrapper", xhr.responseText)
              $("#password").val("")
              $("#password2").val("")
          })

        } else {
          clearComplaints()
          complainSomeMore("#password2-wrapper","The passwords do not match");
        }
    });
});
