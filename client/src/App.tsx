import { ApplicationList } from "./components/ApplicationList";
import { sampleApplication } from "./data";

function App() {
  return (
    <>
      <header className="header">
        <h1>Internship Tracker</h1>
        <p>Keep every application, deadline, and next step in one place.</p>
      </header>

      <main className="container">
        <section className="card">
          <h2>Applications</h2>
          <ApplicationList applications={sampleApplication} />
        </section>
      </main>
    </>
  );
}

export default App;

