


function sumar() {
  let num1 = Number(document.getElementById("num1").value);
  let num2 = Number(document.getElementById("num2").value);
  let resultado = document.getElementById("resultado");

  if (isNaN(num1) || isNaN(num2)) {
    resultado.innerHTML = "❌ Please enter valid numbers";
    resultado.style.color = "red";
  } else {
    let suma = num1 + num2;
    resultado.innerHTML = "✅ The sum is: " + suma;
    resultado.style.color = "#333";
  }
}

function limpiar() {
  document.getElementById("num1").value = "";
  document.getElementById("num2").value = "";
  
  let resultado = document.getElementById("resultado");
  resultado.innerHTML = "";
  resultado.style.color = "black";
}

/*
let numeroUno = parseInt(prompt("Enter the first number:"));
let numeroDos = parseInt(prompt("Enter the second number:"));

if (isNaN(numeroUno) || isNaN(numeroDos)) {
  console.log("❌ Please enter valid numbers");
} else {
  let suma = numeroUno + numeroDos;
  console.log("✅ The sum is: " + suma);
} */