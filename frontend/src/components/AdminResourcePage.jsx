import { useMemo, useState } from "react";

function buildEmptyForm(fields) {
  return fields.reduce(
    (acc, field) => ({ ...acc, [field.name]: "" }),
    {}
  );
}

function getOptionValue(option) {
  return typeof option === "object" ? option.value : option;
}

function getOptionLabel(option) {
  return typeof option === "object" ? option.label : option;
}

// Searchable select: renders a text input that filters the underlying <datalist>.
// Used when field.type === "select" so dropdowns are filterable as you type.
function SearchableSelect({ field, value, onChange }) {
  const [query, setQuery] = useState(
    () => {
      // Pre-fill label if value already set (e.g. on edit)
      if (!value) return "";
      const match = field.options.find(
        (o) => String(getOptionValue(o)) === String(value)
      );
      return match ? getOptionLabel(match) : String(value);
    }
  );

  const listId = `${field.name}-list`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return field.options;
    return field.options.filter((o) =>
      getOptionLabel(o).toLowerCase().includes(q)
    );
  }, [field.options, query]);

  const handleChange = (e) => {
    const text = e.target.value;
    setQuery(text);
    // Try to resolve typed text to a known option value
    const match = field.options.find(
      (o) =>
        getOptionLabel(o).toLowerCase() === text.toLowerCase() ||
        String(getOptionValue(o)) === text
    );
    onChange({ target: { name: field.name, value: match ? getOptionValue(match) : "" } });
  };

  return (
    <div>
      <input
        type="text"
        name={field.name}
        list={listId}
        placeholder={field.label}
        value={query}
        onChange={handleChange}
        autoComplete="off"
      />
      <datalist id={listId}>
        {filtered.map((option) => (
          <option
            key={getOptionValue(option)}
            value={getOptionLabel(option)}
          />
        ))}
      </datalist>
    </div>
  );
}

function AdminResourcePage({
  title,
  description,
  fields,
  records,
  onSave,
  onDelete,
  renderValue = (record, field) => record[field.name],
}) {
  const [form, setForm] = useState(buildEmptyForm(fields));
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSave(editingId ? { ...form, id: editingId } : form);
    setForm(buildEmptyForm(fields));
    setEditingId(null);
  };

  const handleEdit = (record) => {
    const nextForm = fields.reduce(
      (acc, field) => ({ ...acc, [field.name]: record[field.name] ?? "" }),
      {}
    );
    setForm(nextForm);
    setEditingId(record.id);
  };

  const handleCancelEdit = () => {
    setForm(buildEmptyForm(fields));
    setEditingId(null);
  };

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      fields.some((field) =>
        String(renderValue(record, field) || "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [fields, records, renderValue, searchTerm]);

  return (
    <section className="page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <div className="admin-grid">
        {/* ── Form panel ── */}
        <form className="panel admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Record" : "Add Record"}</h3>

          <div className="form-grid">
            {fields.map((field) => {
              if (field.type === "select") {
                // Searchable select (filters as you type)
                return (
                  <SearchableSelect
                    key={field.name}
                    field={field}
                    value={form[field.name]}
                    onChange={handleChange}
                  />
                );
              }

              if (field.type === "datalist") {
                const listId = `${title}-${field.name}-list`;
                return (
                  <div key={field.name}>
                    <input
                      type="text"
                      name={field.name}
                      list={listId}
                      placeholder={field.label}
                      value={form[field.name]}
                      onChange={handleChange}
                    />
                    <datalist id={listId}>
                      {field.options.map((option) => (
                        <option
                          key={getOptionValue(option)}
                          value={getOptionValue(option)}
                        >
                          {getOptionLabel(option)}
                        </option>
                      ))}
                    </datalist>
                  </div>
                );
              }

              return (
                <input
                  key={field.name}
                  type={field.type || "text"}
                  name={field.name}
                  placeholder={field.label}
                  value={form[field.name]}
                  onChange={handleChange}
                />
              );
            })}
          </div>

          <button type="submit" className="primary-button">
            {editingId ? "Update Record" : "Save Record"}
          </button>

          {editingId && (
            <button
              type="button"
              className="ghost-button"
              onClick={handleCancelEdit}
            >
              Cancel Edit
            </button>
          )}
        </form>

        {/* ── Records panel ── */}
        <div className="panel">
          <h3>Current Records</h3>
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}`}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {fields.map((field) => (
                    <th key={field.name}>{field.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    {fields.map((field) => (
                      <td key={field.name}>{renderValue(record, field)}</td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleEdit(record)}
                      >
                        Edit
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          className="ghost-button danger"
                          onClick={() => onDelete(record.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AdminResourcePage;
