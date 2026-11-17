# Treinamentos no servidor .13 (190.111.110.13)

Mesmo servidor do portal: o nginx + certbot já estão lá e o portal responde em 127.0.0.1:8790.

```bash
# 1. DNS (HostGator → Zone Editor → updown.com.br):  treinamentos  A  190.111.110.13
dig +short treinamentos.updown.com.br @8.8.8.8      # tem de responder 190.111.110.13

# 2. Portal atualizado (setores dos usuários + /sso/quem + sistemas "Treinamentos")
#    antes: faça o merge do PR https://github.com/FelpLuis/portalprov/pull/1
cd ~/portalprov && git pull && sudo bash deploy/instalar.sh

# 3. Treinamentos
git clone https://github.com/FelpLuis/treinamentosprov && cd treinamentosprov
sudo bash deploy/instalar.sh                        # /opt/treinamentos-updown, serviço em 127.0.0.1:8791
sudo nano /etc/treinamentos-updown.env              # confira PORTAL_INTERNO=http://127.0.0.1:8790

# 4. nginx + certificado
sudo certbot certonly --webroot -w /var/www/letsencrypt -d treinamentos.updown.com.br
sudo cp deploy/nginx-treinamentos.conf /etc/nginx/sites-available/treinamentos
sudo ln -sf /etc/nginx/sites-available/treinamentos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. Conferir
curl -s http://127.0.0.1:8791/healthz                                   # ok
curl -s https://treinamentos.updown.com.br/ | grep -o "sso/entrar[^\"]*"    # sem sessão: leva ao login do portal
```

Depois, em **portal.updown.com.br → Usuários**:
- botão **Setores**: confira a lista de setores;
- em cada usuário, marque o(s) **setor(es)** e o acesso **Treinamentos UPDOWN**;
- quem vai criar conteúdo recebe também **Treinamentos · Editor** (administradores já editam).

Atualizar depois: `cd treinamentosprov && git pull && sudo bash deploy/instalar.sh`.
Os treinamentos editados e as mídias enviadas ficam em `/var/lib/treinamentos-updown` e não são apagados na atualização.
Backup: `sudo tar czf treinamentos-$(date +%F).tgz -C /var/lib treinamentos-updown`.
