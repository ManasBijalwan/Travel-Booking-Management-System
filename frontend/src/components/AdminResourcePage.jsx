import { useMemo, useState } from "react";

function buildEmptyForm(fields) {
  return fields.reduce((accumulator, field) => ({ ...accumulator, [field.name]: "" }), {});
}

function getOptionValue(option) {
  return typeof option === "object" ? option.value : option;
}

function getOptionLabel(option) {
  return typeof option === "object" ? option.label : option;
}

function AdminResourcePage({
  title,
  description,
  fields,
  records,
  onSave,
  onDelete,
  renderValue = (record, field) => record[field.name]
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
      (accumulator, field) => ({ ...accumulator, [field.name]: record[field.name] ?? "" }),
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
    if (!query) {
      return records;
    }

    return records.filter((record) =>
      fields.some((field) => String(renderValue(record, field) || "").toLowerCase().includes(query))
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
        <form className="panel admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Update Record" : "Add Record"}</h3>
          <div className="form-grid">
            {fields.map((field) => {
              if (field.type === "select") {
                return (
                  <select key={field.name} name={field.name} value={form[field.name]} onChange={handleChange}>
                    <option value="">{field.label}</option>
                    {field.options.map((option) => (
                      <option key={getOptionValue(option)} value={getOptionValue(option)}>
                        {getOptionLabel(option)}
                      </option>
                    ))}
                  </select>
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
                        <option key={getOptionValue(option)} value={getOptionValue(option)}>
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
            <button type="button" className="ghost-button" onClick={handleCancelEdit}>
              Cancel Edit
            </button>
          )}
        </form>

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
