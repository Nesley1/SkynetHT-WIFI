# Modèle d'e-mail de confirmation Skynet Wi-Fi

**Sujet à configurer dans Supabase :** Bienvenue chez Skynet Wi-Fi — confirmez votre adresse e-mail

**Emplacement :** Supabase Dashboard → Authentication → Email Templates → Confirm signup.

Copiez le contenu complet de `confirmation.html` dans le champ HTML du modèle « Confirm signup », puis enregistrez.

Le modèle utilise la variable Supabase officielle `{{ .ConfirmationURL }}`. Le lien de confirmation doit rester celui de Supabase afin de préserver la validation sécurisée du compte.

Le frontend affiche maintenant une confirmation visible après l'inscription, indique l'adresse destinataire et propose le renvoi de l'e-mail.
