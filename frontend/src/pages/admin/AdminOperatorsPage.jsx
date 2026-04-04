import { useEffect, useState } from "react";
import AdminResourcePage from "../../components/AdminResourcePage";
import { deleteAdminResource, getAdminResource, upsertAdminResource } from "../../services/travelService";

const fields = [
  { name: "operator_name", label: "Operator Name" },
  { name: "mode_type", label: "Mode Type", type: "select", options: ["bus", "train", "flight"] },
  { name: "contact_email", label: "Contact Email", type: "email" },
  { name: "contact_phone", label: "Contact Phone" }
];

function AdminOperatorsPage() {
  const [records, setRecords] = useState([]);

  const loadRecords = async () => {
    const result = await getAdminResource("operators");
    setRecords(result);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleSave = async (record) => {
    await upsertAdminResource("operators", record);
    await loadRecords();
  };

  const handleDelete = async (recordId) => {
    await deleteAdminResource("operators", recordId);
    await loadRecords();
  };

  return (
    <AdminResourcePage
      title="Operators"
      description="Manage the operators whose vehicles and routes are added to the system."
      fields={fields}
      records={records}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}

export default AdminOperatorsPage;
