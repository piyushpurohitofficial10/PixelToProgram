function loadJSONTable() {
    var table = document.getElementById("jsonTable");
    var headerRow = table.insertRow();
    headerRow.insertCell().outerHTML = "<th>Name</th>";
    headerRow.insertCell().outerHTML = "<th>Age</th>";
    headerRow.insertCell().outerHTML = "<th>City</th>";

    for (var i = 0; i < jsonData.length; i++) {
        var row = table.insertRow();
        row.insertCell().innerText = jsonData[i].name;
        row.insertCell().innerText = jsonData[i].age;
        row.insertCell().innerText = jsonData[i].city;
    }
}
function loadJSONTable() {
    var table = document.getElementById("jsonTable");
    var headerRow = table.insertRow();
    headerRow.insertCell().outerHTML = "<th>Name</th>";
    headerRow.insertCell().outerHTML = "<th>Age</th>";
    headerRow.insertCell().outerHTML = "<th>City</th>";
    for (var i = 0; i < jsonData.length; i++) {
        var row = table.insertRow();
        row.insertCell().innerText = jsonData[i].name;
        row.insertCell().innerText = jsonData[i].age;
        row.insertCell().innerText = jsonData[i].city;
    }
}