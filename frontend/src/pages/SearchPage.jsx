import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import SearchForm from "../components/SearchForm";
import TravelCard from "../components/TravelCard";
import { useAuth } from "../context/AuthContext";
import { searchTravels } from "../services/travelService";

function SearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isUser } = useAuth();

  const [travels, setTravels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modes, setModes] = useState([]);

  // Fetch travel modes for the SearchForm dropdown once
  useEffect(() => {
    apiClient
      .get("/admin/form-options/vehicles")
      .then((r) => setModes(r.data.modes || []))
      .catch(() => {
        // Fallback static list if backend unavailable
        setModes([
          { value: "Bus", label: "Bus" },
          { value: "Train", label: "Train" },
          { value: "Flight", label: "Flight" },
        ]);
      });
  }, []);

  const filters = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search).entries()),
    [location.search]
  );

  const hasSearch = useMemo(
    () => Object.values(filters).some((v) => String(v || "").trim() !== ""),
    [filters]
  );

  useEffect(() => {
    if (!isUser || !hasSearch) {
      setTravels([]);
      return;
    }
    setLoading(true);
    searchTravels(filters)
      .then(setTravels)
      .catch(() => setTravels([]))
      .finally(() => setLoading(false));
  }, [filters, hasSearch, isUser]);

  const handleSearch = (nextFilters) => {
    const params = new URLSearchParams(nextFilters);
    navigate(`/search?${params.toString()}`);
  };

  if (!isUser) {
    return <Navigate to="/login/user" replace state={{ from: location }} />;
  }

  return (
    <div className="page-shell">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Book Travel</p>
          <h1>Book trips</h1>
        </div>
      </section>

      <div className="panel">
        <SearchForm
          onSearch={handleSearch}
          initialValues={filters}
          compact
          modes={modes}
        />
      </div>

      {loading ? (
        <div className="panel">Loading trips...</div>
      ) : hasSearch ? (
        <div className="card-grid">
          {travels.length ? (
            travels.map((travel) => (
              <TravelCard key={travel.id} travel={travel} />
            ))
          ) : (
            <div className="panel">No trips found for your search.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SearchPage;
