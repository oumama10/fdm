from django.db import models


class RetourMateriel(models.Model):
    MOTIF_CHOICES = [
        ("panne", "panne"),
        ("inutilise", "inutilise"),
        ("endommage", "endommage"),
        ("autre", "autre"),
    ]
    DECISION_CHOICES = [
        ("", ""),
        ("repare", "repare"),
        ("non_repare", "non_repare"),
        ("rebut", "rebut"),
        ("reaffecte", "reaffecte"),
    ]

    id_retour = models.AutoField(primary_key=True)
    date_retour = models.DateField(auto_now_add=True)
    motif_retour = models.CharField(max_length=20, choices=MOTIF_CHOICES)
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, default="", blank=True)
    justification_decision = models.TextField(blank=True)
    observation = models.TextField(blank=True)
    id_ressource = models.ForeignKey("resources.Ressource", on_delete=models.CASCADE)
    id_instance_ressource = models.ForeignKey(
        "resources.InstanceRessource",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    id_retourne_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="retours_soumis",
    )
    id_traite_par = models.ForeignKey(
        "users.Utilisateur",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="retours_traites",
    )

    class Meta:
        verbose_name = "retour materiel"
        verbose_name_plural = "retours materiel"

    def __str__(self):
        return f"Retour {self.id_retour} - {self.id_ressource}"
