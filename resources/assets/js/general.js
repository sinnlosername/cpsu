$(document).ready(() => {
    $("form[data-endpoint]").submit(function (e) {
        e.preventDefault();

        let data = {}, form = $(this);
        form.serializeArray().map((x) => data[x.name] = x.value);
        form.find("input,button").prop("disabled", true);

        function setError(text) {
            form.find(".form-error").text(text);
        }
        setError("");

        let info = form.data("endpoint").split(" ");
        $.ajax({
            type: info[0],
            url: info[1],
            data: JSON.stringify(data),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data) {
                if (data.redirect)
                    window.location = data.redirect;
            },
            error: function(xhr, status, error) {
                if (xhr.readyState !== 4  || xhr.status >= 500) {
                    console.error("Error while sending form", error);
                    setError("An error occured while transfering the form input");
                    return;
                }

                try {
                    let data = JSON.parse(xhr.responseText);
                    setError(data.message);
                } catch (e) {
                    setError("The server responded with an unknown error (" + xhr.status + ")");
                }
            },
            complete: () => {
                form.find("input,button").prop("disabled", false)
            }
        });
    });
});

