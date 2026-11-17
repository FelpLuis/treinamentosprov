// Sem sessão: vai para o login do portal levando o endereço completo (com o #/t/... do treinamento).
(function () {
  var a = document.getElementById("entrar");
  location.replace(a.getAttribute("data-base") + encodeURIComponent(location.href));
})();
