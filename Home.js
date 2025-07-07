import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from './AppProvider';
import { documentTypes, purposes, releaseToOptions } from './constants';
import io from 'socket.io-client';
import './index.css';


const Home = () => {
  const { setError, user } = useContext(AppContext);
  const [stats, setStats] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [selectedStat, setSelectedStat] = useState(null);
  const [categoryDocuments, setCategoryDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [trackingResult, setTrackingResult] = useState(null);
  const [editDocument, setEditDocument] = useState(null);

  useEffect(() => {
    if (!user?._id) {
      setError('User not logged in. Please log in again.');
      return;
    }
    // Fetch stats
    fetch(`/api/documents/${user._id}/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
      })
      .then(data => {
        setStats({
          incoming: data.incoming || 0,
          completedToday: data.completedToday || 0,
          urgent: data.urgent || 0,
          missed: data.missed || 0,
          accepted: data.accepted || 0,
          pending: data.pending || 0,
          createdToday: data.createdToday || 0,
        });
      })
      .catch(err => {
        console.error('Stats fetch error:', err.message);
        setError(err.message);
        setStats({ incoming: 0, completedToday: 0, urgent: 0, missed: 0, accepted: 0, pending: 0, createdToday: 0 });
      });

    // Fetch recent activities
    const today = new Date();
    today.setHours(8, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    fetch(`/api/documents/${user._id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch documents');
        return res.json();
      })
      .then(data => {
        const activities = data
          .filter(doc =>
            !doc.deleted && (
              doc.userId.toString() === user._id ||
              doc.acceptedBy?.toString() === user._id ||
              doc.releaseTo === user.department
            )
          )
          .flatMap(doc =>
            (doc.history || [])
              .filter(event =>
                new Date(event.date) >= today &&
                new Date(event.date) < tomorrow &&
                event.department === user.department &&
                ['Created', 'Received', 'Viewed', 'Deleted', 'Archived', 'Restored', 'Edited', 'Accepted', 'Completed', 'Unarchived'].includes(event.action)
              )
              .map(event => ({
                documentId: doc._id,
                title: doc.title,
                action: event.action,
                date: new Date(event.date),
                department: event.department,
              }))
          )
          .sort((a, b) => b.date - a.date)
          .slice(0, 10);
        setRecentActivities(activities);
      })
      .catch(err => {
        console.error('Recent activities fetch error:', err.message);
        setError(err.message);
      });

    // Fetch documents for selected stat category
    if (selectedStat) {
      const endpoint = `/api/documents/${user._id}/${selectedStat}`;
      fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then(res => {
          if (!res.ok) throw new Error(`Failed to fetch ${selectedStat} documents: ${res.statusText}`);
          return res.json();
        })
        .then(data => {
          const today = new Date();
          today.setHours(8, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          const filteredData = selectedStat === 'missed'
            ? data
            : data.filter(doc =>
                new Date(selectedStat === 'completed-today' ? doc.updatedAt : doc.createdAt) >= today &&
                new Date(selectedStat === 'completed-today' ? doc.updatedAt : doc.createdAt) < tomorrow
              );
          setCategoryDocuments(filteredData.sort((a, b) => new Date(b.createdAt) - a.createdAt));
        })
        .catch(err => {
          console.error(`Category documents fetch error for ${selectedStat}:`, err.message);
          setError(err.message);
        });
    }
  }, [user, setError, selectedStat]);

  useEffect(() => {
    const socket = io('http://localhost:5001');
    socket.on('documentUpdate', (data) => {
      // Refresh stats
      fetch(`/api/documents/${user._id}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch stats');
          return res.json();
        })
        .then(data => {
          setStats({
            incoming: data.incoming || 0,
            completedToday: data.completedToday || 0,
            urgent: data.urgent || 0,
            missed: data.missed || 0,
            accepted: data.accepted || 0,
            pending: data.pending || 0,
            createdToday: data.createdToday || 0,
          });
        })
        .catch(err => {
          console.error('Stats fetch error (WebSocket):', err.message);
          setError(err.message);
        });

      // Refresh recent activities
      const today = new Date();
      today.setHours(8, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      fetch(`/api/documents/${user._id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch documents');
          return res.json();
        })
        .then(data => {
          const activities = data
            .filter(doc =>
              !doc.deleted && (
                doc.userId.toString() === user._id ||
                doc.acceptedBy?.toString() === user._id ||
                doc.releaseTo === user.department
              )
            )
            .flatMap(doc =>
              (doc.history || [])
                .filter(event =>
                  new Date(event.date) >= today &&
                  new Date(event.date) < tomorrow &&
                  event.department === user.department &&
                  ['Created', 'Received', 'Viewed', 'Deleted', 'Archived', 'Restored', 'Edited', 'Accepted', 'Completed', 'Unarchived'].includes(event.action)
                )
                .map(event => ({
                  documentId: doc._id,
                  title: doc.title,
                  action: event.action,
                  date: new Date(event.date),
                  department: event.department,
                }))
            )
            .sort((a, b) => b.date - a.date)
            .slice(0, 10);
          setRecentActivities(activities);
        })
        .catch(err => {
          console.error('Recent activities fetch error (WebSocket):', err.message);
          setError(err.message);
        });

      // Refresh category documents
      if (selectedStat) {
        fetch(`/api/documents/${user._id}/${selectedStat}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        })
          .then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${selectedStat} documents: ${res.statusText}`);
            return res.json();
          })
          .then(data => {
            const today = new Date();
            today.setHours(8, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const filteredData = selectedStat === 'missed'
              ? data
              : data.filter(doc =>
                  new Date(selectedStat === 'completed-today' ? doc.updatedAt : doc.createdAt) >= today &&
                  new Date(selectedStat === 'completed-today' ? doc.updatedAt : doc.createdAt) < tomorrow
              );
            setCategoryDocuments(filteredData.sort((a, b) => new Date(b.createdAt) - a.createdAt));
          })
          .catch(err => {
            console.error(`Category documents fetch error for ${selectedStat} (WebSocket):`, err.message);
            setError(err.message);
          });
      }
    });
    return () => socket.disconnect();
  }, [user, setError, selectedStat]);

  const handleStatClick = (category) => {
    const statMap = {
      incoming: 'incoming',
      completedToday: 'completed-today',
      urgent: 'urgent',
      missed: 'missed',
      createdToday: 'created-today',
    };
    const selectedCategory = statMap[category];
    setSelectedStat(selectedCategory);
    setSelectedDocument(null);
    setSelectedDocIds([]);
    setTrackingResult(null);
    setEditDocument(null);
  };

  const handleToggleSelect = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleViewDocument = (doc) => {
    setSelectedDocument(doc);
    setTrackingResult(null);
    setEditDocument(null);
    if (!(doc.viewedBy || []).includes(user._id)) {
      fetch(`/api/document/${doc._id}/view`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ userId: user._id }),
        credentials: 'include',
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to mark document as viewed');
          return res.json();
        })
        .then(updatedDoc => {
          setRecentActivities(prev => prev.map(activity =>
            activity.documentId === doc._id && activity.action === 'Created'
              ? { ...activity, viewedBy: updatedDoc.viewedBy }
              : activity
          ));
          setCategoryDocuments(prev => prev.map(d => d._id === doc._id ? updatedDoc : d));
        })
        .catch(err => setError(err.message));
    }
  };

  const handleTrackDocument = (docId) => {
    fetch(`/api/document/${docId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.message || 'Failed to fetch document for tracking'); });
        }
        return res.json();
      })
      .then(doc => {
        if (!doc) {
          throw new Error('Document not found');
        }
        setTrackingResult({
          id: doc._id,
          title: doc.title,
          status: doc.status,
          currentLocation: doc.department,
          lastUpdated: new Date(doc.updatedAt || doc.createdAt).toLocaleString(),
          documentType: doc.documentType,
          purpose: doc.purpose,
          releaseTo: doc.releaseTo,
          history: doc.history || [],
        });
        setError(null);
      })
      .catch(err => {
        console.error('Tracking error:', err);
        setTrackingResult(null);
        setError(`Failed to track document: ${err.message}`);
      });
  };

  const handleAcceptDocument = (doc) => {
    fetch(`/api/document/${doc._id}/accept`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ userId: user._id }),
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to accept document');
        return res.json();
      })
      .then(data => {
        setCategoryDocuments(prev => prev.filter(d => d._id !== data._id));
        setRecentActivities(prev => prev.filter(activity => activity.documentId !== data._id));
        setStats(prev => ({
          ...prev,
          incoming: prev.incoming - 1,
          accepted: prev.accepted + 1,
        }));
        setSelectedDocument(null);
        setSelectedStat('incoming');
        setSelectedDocIds([]);
        setTrackingResult(null);
        setEditDocument(null);
        alert('Document accepted successfully');
      })
      .catch(err => setError(err.message));
  };

  const handleBulkAccept = async () => {
    if (selectedDocIds.length === 0) {
      setError('No documents selected');
      return;
    }
    if (!window.confirm(`Are you sure you want to accept ${selectedDocIds.length} document(s)?`)) return;
    try {
      const promises = selectedDocIds.map((docId) =>
        fetch(`/api/document/${docId}/accept`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ userId: user._id }),
        }).then(res => {
          if (!res.ok) throw new Error(`Failed to accept document ${docId}`);
          return res.json();
        })
      );
      await Promise.all(promises);
      setCategoryDocuments(prev => prev.filter(doc => !selectedDocIds.includes(doc._id)));
      setRecentActivities(prev => prev.filter(activity => !selectedDocIds.includes(activity.documentId)));
      setStats(prev => ({
        ...prev,
        incoming: prev.incoming - selectedDocIds.length,
        accepted: prev.accepted + selectedDocIds.length,
      }));
      setSelectedDocIds([]);
      setEditDocument(null);
      alert(`${selectedDocIds.length} document(s) accepted successfully`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCompleteDocument = (docId) => {
    if (!window.confirm('Are you sure you want to complete this document?')) return;
    fetch(`/api/documents/${docId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ userId: user._id, department: user.department }),
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to complete document');
        return res.json();
      })
      .then(data => {
        setCategoryDocuments(prev => prev.filter(doc => doc._id !== docId));
        setStats(prev => ({
          ...prev,
          accepted: prev.accepted - 1,
          completedToday: prev.completedToday + 1,
        }));
        setSelectedDocument(null);
        setEditDocument(null);
        alert('Document completed successfully');
      })
      .catch(err => setError(err.message));
  };

  const handleArchiveDocument = (docId) => {
    if (!window.confirm('Are you sure you want to archive this document?')) return;
    fetch(`/api/documents/${docId}/archive`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ userId: user._id, department: user.department }),
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to archive document');
        return res.json();
      })
      .then(updatedDoc => {
        setCategoryDocuments(prev => prev.filter(doc => doc._id !== docId));
        setSelectedDocument(null);
        setEditDocument(null);
        alert('Document archived successfully');
      })
      .catch(err => setError(err.message));
  };

  const handleDeleteDocument = (docId) => {
    if (!window.confirm('Are you sure you want to move this document to Trash? It will be permanently deleted after 30 days.')) return;
    fetch(`/api/documents/${docId}/delete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      credentials: 'include',
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete document');
        return res.json();
      })
      .then(() => {
        setCategoryDocuments(prev => prev.filter(doc => doc._id !== docId));
        setStats(prev => ({
          ...prev,
          createdToday: prev.createdToday - 1,
        }));
        setSelectedDocument(null);
        setEditDocument(null);
        alert('Document moved to Trash');
      })
      .catch(err => setError(err.message));
  };

  const handleEditDocument = (doc) => {
    setEditDocument({
      _id: doc._id,
      title: doc.title,
      description: doc.description,
      documentType: doc.documentType,
      purpose: doc.purpose,
      releaseTo: doc.releaseTo,
      urgent: doc.urgent,
    });
  };

  const handleUpdateDocument = () => {
    if (!editDocument.title || !editDocument.description || !editDocument.documentType ||
        !editDocument.purpose || !editDocument.releaseTo) {
      setError('All fields are required');
      return;
    }
    fetch(`/api/documents/${editDocument._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        title: editDocument.title,
        description: editDocument.description,
        urgent: editDocument.urgent,
        documentType: editDocument.documentType,
        purpose: editDocument.purpose,
        releaseTo: editDocument.releaseTo,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update document');
        return res.json();
      })
      .then(updatedDoc => {
        setCategoryDocuments(prev => prev.map(doc => doc._id === updatedDoc._id ? updatedDoc : doc));
        setSelectedDocument(null);
        setEditDocument(null);
        alert('Document updated successfully');
      })
      .catch(err => setError(err.message));
  };

  const handleBack = () => {
    setSelectedStat(null);
    setSelectedDocument(null);
    setSelectedDocIds([]);
    setTrackingResult(null);
    setEditDocument(null);
  };

  const renderEditDocument = () => (
    <div>
      <button className="action-button" onClick={handleBack}>
        <i className="fas fa-arrow-left"></i> Back
      </button>
      <h3>Edit Document</h3>
      <div className="form-group">
        <label>Title</label>
        <input
          type="text"
          className="input-field"
          value={editDocument.title}
          onChange={(e) => setEditDocument({ ...editDocument, title: e.target.value })}
          placeholder="Enter document title"
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea
          className="input-field textarea"
          rows="4"
          value={editDocument.description}
          onChange={(e) => setEditDocument({ ...editDocument, description: e.target.value })}
          placeholder="Enter document description"
        ></textarea>
      </div>
      <div className="form-group">
        <label>Document Type</label>
        <select
          className="input-field select"
          value={editDocument.documentType}
          onChange={(e) => setEditDocument({ ...editDocument, documentType: e.target.value })}
        >
          <option value="">Select Document Type</option>
          {documentTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Purpose</label>
        <select
          className="input-field select"
          value={editDocument.purpose}
          onChange={(e) => setEditDocument({ ...editDocument, purpose: e.target.value })}
        >
          <option value="">Select Purpose</option>
          {purposes.map(purpose => (
            <option key={purpose} value={purpose}>{purpose}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Release To</label>
        <select
          className="input-field select"
          value={editDocument.releaseTo}
          onChange={(e) => setEditDocument({ ...editDocument, releaseTo: e.target.value })}
        >
          <option value="">Select Release To</option>
          <optgroup label="Unit">
            {releaseToOptions
              .filter(release => release.startsWith('Unit:'))
              .map(release => (
                <option key={release} value={release}>{release}</option>
              ))}
          </optgroup>
          <optgroup label="School">
            {releaseToOptions
              .filter(release => release.startsWith('School:'))
              .map(release => (
                <option key={release} value={release}>{release}</option>
              ))}
          </optgroup>
          <optgroup label="Private School">
            {releaseToOptions
              .filter(release => release.startsWith('Private School:'))
              .map(release => (
                <option key={release} value={release}>{release}</option>
              ))}
          </optgroup>
          <optgroup label="Agency">
            {releaseToOptions
              .filter(release => release.startsWith('Agency:'))
              .map(release => (
                <option key={release} value={release}>{release}</option>
              ))}
          </optgroup>
        </select>
      </div>
      <div className="form-group">
        <label>Urgent</label>
        <input
          type="checkbox"
          checked={editDocument.urgent}
          onChange={(e) => setEditDocument({ ...editDocument, urgent: e.target.checked })}
        />
      </div>
      <button className="submit-button" onClick={handleUpdateDocument}>
        Update Document
      </button>
    </div>
  );

  const renderDocumentList = (title, docs) => (
    <div>
      <button className="action-button primary" onClick={handleBack}>
        <i className="fas fa-arrow-left"></i> Back to Dashboard
      </button>
      <h3 className="section-title">{title}</h3>
      {title === 'Incoming Documents' && selectedDocIds.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            className="action-button success"
            onClick={handleBulkAccept}
          >
            <i className="fas fa-check"></i> Accept Selected ({selectedDocIds.length})
          </button>
        </div>
      )}
      {docs.length === 0 ? (
        <p>{title === 'Missed Documents' ? 'No missed documents found (unviewed for 24 hours or more).' : `No ${title.toLowerCase()} found.`}</p>
      ) : (
        <ul className="document-list">
          {docs.map(doc => (
            <li
              key={doc._id}
              className={`document-item ${selectedStat === 'missed' ? 'missed' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                {title === 'Incoming Documents' && !doc.accepted && doc.releaseTo === user.department && (
                  <input
                    type="checkbox"
                    checked={selectedDocIds.includes(doc._id)}
                    onChange={() => handleToggleSelect(doc._id)}
                  />
                )}
                <div
                  onClick={() => handleViewDocument(doc)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem' }}
                >
                  <span style={{ whiteSpace: 'nowrap' }}><strong>{doc.title}</strong> (<span>{doc._id}</span>)</span>
                  <span style={{ whiteSpace: 'nowrap' }}>
                    Sent by: <strong>{doc.createdByUsername || 'Unknown User'}</strong> (<span>{doc.department}</span>)
                  </span>
                  <span style={{ whiteSpace: 'nowrap' }}>Status: <strong>{doc.status}</strong></span>
                  {doc.urgent && <span className="urgent-tag">Urgent</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {title === 'Incoming Documents' && !doc.accepted && doc.releaseTo === user.department && (
                  <button className="action-button success" onClick={() => handleAcceptDocument(doc)}>
                    <i className="fas fa-check"></i> Accept
                  </button>
                )}
                {selectedStat === 'accepted' && doc.acceptedBy === user._id && (
                  <button className="action-button success" onClick={() => handleCompleteDocument(doc._id)}>
                    <i className="fas fa-check-circle"></i> Complete
                  </button>
                )}
                {title === 'Created Today' && doc.userId.toString() === user._id && !doc.archived && !doc.completed && !doc.deleted && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="action-button warning"
                      onClick={() => handleEditDocument(doc)}
                    >
                      <i className="fas fa-edit"></i> Edit
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleArchiveDocument(doc._id)}
                    >
                      <i className="fas fa-archive"></i> Archive
                    </button>
                    <button
                      className="action-button danger"
                      onClick={() => handleDeleteDocument(doc._id)}
                    >
                      <i className="fas fa-trash"></i> Delete
                    </button>
                  </div>
                )}
                {title !== 'Created Today' && (
                  <button
                    className="action-button"
                    onClick={() => handleTrackDocument(doc._id)}
                  >
                    <i className="fas fa-search"></i> Track
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderDocumentDetails = () => (
    <div>
      <button className="action-button" onClick={() => setSelectedDocument(null)}>
        <i className="fas fa-arrow-left"></i> Back to List
      </button>
      <h3>Document Details</h3>
      <div className="info-item">
        <label>Document ID:</label>
        <span>{selectedDocument._id}</span>
      </div>
      <div className="info-item">
        <label>Title:</label>
        <span>{selectedDocument.title}</span>
      </div>
      <div className="info-item">
        <label>Description:</label>
        <span>{selectedDocument.description}</span>
      </div>
      <div className="info-item">
        <label>Status:</label>
        <span>{selectedDocument.status}</span>
      </div>
      <div className="info-item">
        <label>Department:</label>
        <span>{selectedDocument.department}</span>
      </div>
      <div className="info-item">
        <label>Created By:</label>
        <span><strong>{selectedDocument.createdByUsername || 'Unknown User'}</strong> (<span>{selectedDocument.userId}</span>)</span>
      </div>
      {selectedDocument.routedByUsername && (
        <div className="info-item">
          <label>Routed By:</label>
          <span><strong>{selectedDocument.routedByUsername}</strong></span>
        </div>
      )}
      <div className="info-item">
        <label>Document Type:</label>
        <span>{selectedDocument.documentType}</span>
      </div>
      <div className="info-item">
        <label>Purpose:</label>
        <span>{selectedDocument.purpose}</span>
      </div>
      <div className="info-item">
        <label>Release To:</label>
        <span>{selectedDocument.releaseTo || 'Not specified'}</span>
      </div>
      <div className="info-item">
        <label>Created At:</label>
        <span>{new Date(selectedDocument.createdAt).toLocaleString()}</span>
      </div>
      <div className="info-item">
        <label>Urgent:</label>
        <span>{selectedDocument.urgent ? 'Yes' : 'No'}</span>
      </div>
    </div>
  );

  const renderTrackingDetails = () => (
    <div>
      <button className="action-button primary" onClick={() => setTrackingResult(null)}>
        <i className="fas fa-arrow-left"></i> Back to Dashboard
      </button>
      <div className="tracking-results">
        <div className="tracking-header">
          <h3>Document: {trackingResult.title}</h3>
          <span className={`status-badge ${trackingResult.status.toLowerCase().replace(' ', '-')}`}>
            <strong>{trackingResult.status}</strong>
          </span>
        </div>
        <div className="tracking-info">
          <div className="info-item">
            <label>Document ID:</label>
            <span>{trackingResult.id}</span>
          </div>
          <div className="info-item">
            <label>Current Location:</label>
            <span>{trackingResult.currentLocation}</span>
          </div>
          <div className="info-item">
            <label>Document Type:</label>
            <span>{trackingResult.documentType}</span>
          </div>
          <div className="info-item">
            <label>Purpose:</label>
            <span>{trackingResult.purpose}</span>
          </div>
          <div className="info-item">
            <label>Release To:</label>
            <span>{trackingResult.releaseTo}</span>
          </div>
          <div className="info-item">
            <label>Last Updated:</label>
            <span>{trackingResult.lastUpdated}</span>
          </div>
        </div>
        <h4>Document History</h4>
        <div className="tracking-timeline">
          {trackingResult.history.length > 0 ? (
            trackingResult.history.map((event, index) => (
              <div key={index} className="timeline-event">
                <div className="timeline-point"></div>
                <div className="timeline-content">
                  <p className="event-action">{event.action}</p>
                  <p className="event-department">{event.department}</p>
                  <p className="event-date">{new Date(event.date).toLocaleString()}</p>
                </div>
              </div>
            ))
          ) : (
            <p>No history available for this document.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (editDocument) {
      return renderEditDocument();
    }
    if (trackingResult) {
      return renderTrackingDetails();
    }
    if (selectedDocument) {
      return renderDocumentDetails();
    }
    if (selectedStat) {
      const titles = {
        incoming: 'Incoming Documents',
        'completed-today': 'Completed Today',
        urgent: 'Urgent Requests',
        missed: 'Missed Documents',
        'created-today': 'Created Today',
      };
      return renderDocumentList(titles[selectedStat], categoryDocuments);
    }

    return (
      <>
        <div className="welcome-banner">
          <h2>Welcome to SDOLC Tracking System</h2>
          <p>Manage your documents efficiently for the School Division of Laoag City</p>
        </div>
        {!stats && <p>Loading stats...</p>}
        {stats && (
          <div className="stats-container">
            <div className="stat-card" onClick={() => handleStatClick('incoming')}>
              <i className="fas fa-inbox"></i>
              <h3>{stats.incoming}</h3>
              <p>View and accept new documents assigned to you</p>
            </div>
            <div className="stat-card" onClick={() => handleStatClick('completedToday')}>
              <i className="fas fa-check-circle"></i>
              <h3>{stats.completedToday}</h3>
              <p>Completed Today</p>
            </div>
            <div className="stat-card" onClick={() => handleStatClick('urgent')}>
              <i className="fas fa-clock"></i>
              <h3>{stats.urgent}</h3>
              <p>Urgent Requests</p>
            </div>
            <div className="stat-card" onClick={() => handleStatClick('missed')}>
              <i className="fas fa-exclamation-triangle"></i>
              <h3>{stats.missed}</h3>
              <p>Missed Documents</p>
            </div>
            <div className="stat-card" onClick={() => handleStatClick('createdToday')}>
              <i className="fas fa-file-alt"></i>
              <h3>{stats.createdToday}</h3>
              <p>Created Today</p>
            </div>
          </div>
        )}
        <div className="recent-activity">
          <h3 className="section-title">Recent Activity (Today)</h3>
          <ul className="activity-list">
            {recentActivities.length === 0 ? (
              <li>
                <i className="fas fa-info-circle activity-icon"></i>
                <div>
                  <p>No recent activities found for today.</p>
                </div>
              </li>
            ) : (
              recentActivities.map((activity, index) => (
                <li
                  key={`${activity.documentId}-${activity.date}-${index}`}
                  className="document-item"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/document/${activity.documentId}`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        },
                      });
                      if (!res.ok) throw new Error('Failed to fetch document details');
                      const doc = await res.json();
                      handleViewDocument(doc);
                    } catch (err) {
                      setError('Could not load document details');
                    }
                  }}
                >
                  <i className={`fas fa-file-import activity-icon ${activity.action.toLowerCase()}`}></i>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <p><strong>{activity.title}</strong> (<span>{activity.documentId}</span>)</p>
                      <span className="activity-time">
                        Origin: <strong>{activity.department}</strong>
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`activity-action ${activity.action.toLowerCase()}`}><strong>{activity.action}</strong></span>
                      <span style={{ display: 'block', color: '#888', fontSize: '0.9em' }}>Date: {activity.date.toLocaleDateString()}</span>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </>
    );
  };

  return (
    <div className="content-card">
      {renderContent()}
    </div>
  );
};

export default Home;