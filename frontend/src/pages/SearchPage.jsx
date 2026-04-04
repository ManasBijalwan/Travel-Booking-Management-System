import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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

  const filters = useMemo(
    () => Object.fromEntries(new URLSearchParams(location.search).entries()),
    [location.search]
  );

  const hasSearch = useMemo(
    () => Object.values(filters).some((value) => String(value || "").trim() !== ""),
    [filters]
  );

  useEffect(() => {
    const loadTravels = async () => {
      setLoading(true);
      const result = await searchTravels(filters);
      setTravels(result);
      setLoading(false);
    };

    if (!isUser) {
      return;
    }

    if (!hasSearch) {
      setTravels([]);
      setLoading(false);
      return;
    }

    loadTravels();
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
        <SearchForm onSearch={handleSearch} initialValues={filters} compact />
      </div>

      {loading ? (
        <div className="panel">Loading trips...</div>
      ) : hasSearch ? (
        <div className="card-grid">
          {travels.length ? (
            travels.map((travel) => <TravelCard key={travel.id} travel={travel} />)
          ) : (
            <div className="panel">No trips found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SearchPage;
