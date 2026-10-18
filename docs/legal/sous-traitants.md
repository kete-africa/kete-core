# Sous-traitants de Kete

> **Projet — non en vigueur.** Liste établie le 18 octobre 2026 à partir du système tel qu'il
> fonctionne. Elle est mise à jour avant tout nouveau sous-traitant ; les clients en sont informés
> trente jours à l'avance (voir l'accord de traitement des données).

Kete fait appel aux prestataires suivants pour fournir le service. Chacun ne reçoit que ce qui est
nécessaire à sa tâche.

| Prestataire                              | Rôle                                                                       | Données traitées                                                            | Lieu                                                       | Toujours utilisé ?                                              |
| ---------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Neon (Databricks)                        | Bases de données PostgreSQL et stockage de fichiers                        | Toutes les données du service                                               | Union européenne — Francfort, Allemagne (AWS eu-central-1) | Oui                                                             |
| […] — hébergeur des serveurs applicatifs | Exécution des applications Kete (Coolify)                                  | Données en transit et journaux techniques                                   | […]                                                        | Oui                                                             |
| OpenAI                                   | Modèles d'intelligence artificielle (réponses, voix, recherche sur le web) | Ce que la personne demande à Kete Intelligence et le contexte nécessaire    | États-Unis                                                 | Si l'organisation utilise Kete Intelligence avec ce fournisseur |
| Mistral AI                               | Modèles d'intelligence artificielle, dictée et voix (au choix)             | Idem                                                                        | Union européenne — France                                  | Si l'organisation le choisit                                    |
| MailKite                                 | Envoi des e-mails (invitations, nouveaux mots de passe, notifications)     | Adresse du destinataire, contenu du message                                 | […]                                                        | Oui, dès qu'un e-mail part                                      |
| Chariow                                  | Paiement des abonnements (dont mobile money)                               | Identité de l'acheteur, montant, statut du paiement                         | […]                                                        | Si l'organisation paie en ligne                                 |
| Meta (WhatsApp Business)                 | Messages WhatsApp                                                          | Numéro de téléphone, contenu des messages                                   | Monde                                                      | Si l'organisation active WhatsApp                               |
| Telegram                                 | Messages Telegram                                                          | Identifiant Telegram, contenu des messages                                  | Monde                                                      | Si l'organisation active Telegram                               |
| Boat                                     | Ordinateurs isolés des agents (bac à sable)                                | Ce que l'agent y écrit pour sa tâche ; jamais les secrets de l'organisation | […]                                                        | Si l'organisation active « un ordinateur à eux »                |
| Langfuse                                 | Observation du fonctionnement des modèles (traces)                         | Mesures d'appel ; le contenu seulement si l'organisation l'autorise         | Union européenne                                           | Si activé                                                       |

Les clés et secrets confiés par une organisation (ses outils connectés) sont chiffrés (AES-256-GCM)
dans la base de Kete ; aucun prestataire ne les reçoit, sauf l'outil de l'organisation lui-même au
moment où il est appelé.
