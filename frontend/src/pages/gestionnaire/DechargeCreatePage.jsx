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
    <div style={{ display: 'grid', gap: 14 }}>
      <h1 style={{ margin: 0 }}>Créer la décharge — Demande #{demande_id}</h1>

      <section style={sectionStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 10 }}>Lignes</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
              <th style={thStyle}>Article</th>
              <th style={thStyle}>Catégorie</th>
              <th style={thStyle}>Qté / Instance</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(({ ligne, isCons, quantity, instanceId }) => {
              const availableInstances = availableInstancesByResource.get(String(ligne.id_ressource)) || [];

              return (
                <tr key={ligne.id_ligne} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{ligne.ressource?.designation || '—'}</td>
                  <td style={tdStyle}>{ligne.ressource?.categorie_nom || '—'}</td>
                  <td style={tdStyle}>
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
                        style={inputStyle}
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
                        style={inputStyle}
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

      <section style={sectionStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={labelStyle}>
            Date livraison
            <input type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            Livré à (chef service)
            <select value={idLivreA} onChange={(e) => setIdLivreA(e.target.value)} style={inputStyle}>
              <option value="">Sélectionner</option>
              {chefs.map((chef) => (
                <option key={chef.id} value={chef.id}>{chef.nom}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ ...labelStyle, marginTop: 10 }}>
          Observation
          <textarea value={observation} onChange={(e) => setObservation(e.target.value)} rows={3} style={textareaStyle} />
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button style={primaryButton} onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Création...' : 'Créer la décharge'}
        </button>
      </div>
    </div>
  );
}

const sectionStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  background: '#fff',
  padding: 12,
};

const thStyle = { padding: 10, fontWeight: 600 };
const tdStyle = { padding: 10 };

const labelStyle = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  color: '#374151',
};

const inputStyle = {
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
};

const primaryButton = {
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};
