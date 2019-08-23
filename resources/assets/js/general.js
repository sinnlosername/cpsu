$(document).ready(() => {
    $("form[data-endpoint]").submit(handleSubmit);
});


function handleSubmit(e) {
    e.preventDefault();

    let data = {}, form = $(this);
    setLoading(form, true);
    form.serializeArray().map((x) => data[x.name] = x.value);

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
            setLoading(form, false);
        }
    });
}

function setLoading(elementSel, loading) {
    let currentSpinner = elementSel.children(".loading-overlay");

    if (currentSpinner.length !== 0 && loading) return;
    if (currentSpinner.length === 0 && !loading) return;
    if (currentSpinner.length !== 0 && !loading) {
        currentSpinner.remove();
        return;
    }

    function createDiv(classes, parent) {
        return $("<div></div>").addClass(classes).appendTo(parent);
    }

    let loadingOverlay = createDiv('loading-overlay', elementSel);
    let progress = createDiv('loading-bar', loadingOverlay);
    createDiv('indeterminate', progress);
}

