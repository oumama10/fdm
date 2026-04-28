import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { createDecharge, getDecharges } from '../../api/decharge';
import { getDemandeById, getDemandes } from '../../api/requests';
import { getInstances } from '../../api/resources';

export default function DechargeCreatePage() {
  const { demande_id } = useParams();
  const navigate = useNavigate();

  const demandeQuery = useQuery({
    queryKey: ['demandes', 'detail', demande_id],
    queryFn: () => getDemandeById(demande_id),
    enabled: !!demande_id,
    staleTime: 30000,
  });

  const demandesQuery = useQuery({
    queryKey: ['demandes', 'list', 'for-chefs'],
    queryFn: () => getDemandes(),
    staleTime: 30000,
  });

  const instancesQuery = useQuery({
    queryKey: ['resources', 'instances'],
    queryFn: getInstances,
    staleTime: 30000,
  });

  const demande = demandeQuery.data?.data;

  const [dateLivraison, setDateLivraison] = useState('');
  const [observation, setObservation] = useState('');
  const [idLivreA, setIdLivreA] = useState('');
  const [lineState, setLineState] = useState({});

  const chefs = useMemo(() => {
    const map = new Map();
    (demandesQuery.data?.data || []).forEach((d) => {
      if (d.chef_demandeur?.id_utilisateur) {
        map.set(String(d.chef_demandeur.id_utilisateur), d.chef_demandeur.nom_complet);
      }
    });
    return Array.from(map.entries()).map(([id, nom]) => ({ id, nom }));
  }, [demandesQuery.data?.data]);

  const availableInstancesByResource = useMemo(() => {
    const grouped = new Map();
    (instancesQuery.data?.data || []).forEach((inst) => {
      if (inst.statut === 'en_stock') {
        const key = String(inst.id_ressource);
        const current = grouped.get(key) || [];
        current.push(inst);
        grouped.set(key, current);
      }
    });
    return grouped;
  }, [instancesQuery.data?.data]);

  const createMutation = useMutation({
    mutationFn: createDecharge,
    onSuccess: async () => {
      const list = await getDecharges();
      const created = (list.data || [])
        .filter((d) => Number(d.id_demande) === Number(demande_id))
        .sort((a, b) => new Date(b.date_generation || 0) - new Date(a.date_generation || 0))[0];

      if (created?.id_decharge) {
        navigate(`/gestionnaire/decharges/${created.id_decharge}`);
      } else {
        navigate('/gestionnaire/decharges');
      }
    },
  });

  if (demandeQuery.isLoading) {
    return <div style={{ height: 220, background: '#f3f4f6', borderRadius: 12 }} />;
  }

  if (!demande) {
    return <div style={{ color: '#b91c1c' }}>Demande introuvable.</div>;
  }

  const lignes = (demande.lignes || []).map((ligne) => {
    const isCons = ligne.ressource?.categorie_nom === 'Consommable';
    const state = lineState[ligne.id_ligne] || {};

    return {
      ligne,
      isCons,
      quantity: state.quantity ?? (ligne.quantite_accordee > 0 ? ligne.quantite_accordee : ligne.quantite_demandee),
      instanceId: state.instanceId ?? '',
    };
  });

  async function handleSubmit() {
    const payload = {
      id_demande: Number(demande_id),
      date_livraison: dateLivraison || null,
      observation,
      id_livre_a: idLivreA ? Number(idLivreA) : null,
      lignes: lignes.map(({ ligne, isCons, quantity, instanceId }) => ({
        id_ressource: Number(ligne.id_ressource),
        quantite: isCons ? Number(quantity || 1) : 1,
        type_ligne: isCons ? 'consommable' : 'bien_inventaire',
        ...(isCons ? {} : { id_instance_ressource: instanceId ? Number(instanceId) : null }),
      })),
    };

    await createMutation.mutateAsync(payload);
  }

  return (
    <div className="page-stack">
      <h1 className="page-title">Créer la décharge - Demande #{demande_id}</h1>

      <section className="section-shell">
        <h3 className="section-title">Lignes</h3>
        <table className="data-table" style={{ fontSize: 14 }}>
          <thead>
            <tr>
              <th>Article</th>
              <th>Catégorie</th>
              <th>Qté / Instance</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ ligne, isCons, quantity, instanceId }) => {
              const availableInstances = availableInstancesByResource.get(String(ligne.id_ressource)) || [];

              return (
                <tr key={ligne.id_ligne}>
                  <td>{ligne.ressource?.designation || '—'}</td>
                  <td>{ligne.ressource?.categorie_nom || '—'}</td>
                  <td>
                    {isCons ? (
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) =>
                          setLineState((prev) => ({
                            ...prev,
                            [ligne.id_ligne]: {
                              ...(prev[ligne.id_ligne] || {}),
                              quantity: Number(e.target.value),
                            },
                          }))
                        }
                        className="field-input"
                      />
                    ) : (
                      <select
                        value={instanceId}
                        onChange={(e) =>
                          setLineState((prev) => ({
                            ...prev,
                            [ligne.id_ligne]: {
                              ...(prev[ligne.id_ligne] || {}),
                              instanceId: e.target.value,
                            },
                          }))
                        }
                        className="field-input"
                      >
                        <option value="">Sélectionner instance</option>
                        {availableInstances.map((inst) => (
                          <option key={inst.id_instance} value={inst.id_instance}>
                            {inst.numero_inventaire} ({inst.etat})
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="section-shell">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field-label">
            Date livraison
            <input type="date" name="date-livraison" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} className="field-input" />
          </label>

          <label className="field-label">
            Livré à (chef service)
            <select value={idLivreA} onChange={(e) => setIdLivreA(e.target.value)} className="field-input">
              <option value="">Sélectionner</option>
              {chefs.map((chef) => (
                <option key={chef.id} value={chef.id}>{chef.nom}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-label" style={{ marginTop: 10 }}>
          Observation
          <textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={3} className="field-input" style={{ resize: 'vertical' }} />
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Création...' : 'Créer la décharge'}
        </button>
      </div>
    </div>
  );
}
