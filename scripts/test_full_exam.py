"""Test completo: avvia esame, risponde a tutte, verifica risultato e statistiche."""

from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / "data" / "_screens"
OUT.mkdir(parents=True, exist_ok=True)


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 1000})
        page = context.new_page()
        errs = []
        page.on("pageerror", lambda err: errs.append(f"PAGEERROR: {err}"))

        # Avvia esame
        page.goto("http://127.0.0.1:8765/#/esame", wait_until="networkidle")
        page.wait_for_timeout(500)

        # Rispondi a tutte le 20 domande base (sempre la prima opzione)
        for i in range(20):
            page.locator(".risp").first.click()
            page.wait_for_timeout(20)
            if i < 19:
                page.locator("#next").click()
                page.wait_for_timeout(20)
        # Concludi base -> passa a vela
        page.locator("#endbase").click()
        page.wait_for_timeout(200)

        # Rispondi a tutte le 5 vela
        for i in range(5):
            page.locator(".risp").first.click()
            page.wait_for_timeout(20)
            if i < 4:
                page.locator("#next").click()
                page.wait_for_timeout(20)
        # Concludi esame
        page.locator("#endvela").click()
        page.wait_for_timeout(500)

        # Verifica pagina risultato
        page.wait_for_url("**/#/esame/risultato")
        page.screenshot(path=str(OUT / "06_risultato.png"), full_page=False)
        print("Risultato -> screenshot 06_risultato.png")

        # Torna alla home, le statistiche devono essere aggiornate
        page.click('a[href="#/home"]')
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "07_home_dopo.png"), full_page=True)
        print("Home post esame -> screenshot 07_home_dopo.png")

        # Verifica che ora sbagliate non sia vuoto (probabilmente molte risposte sbagliate sempre prima opzione)
        page.click('a[href="#/sbagliate"]')
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "08_sbagliate_dopo.png"), full_page=False)
        print("Sbagliate post esame -> screenshot 08_sbagliate_dopo.png")

        browser.close()
        print("\n--- Errors ---")
        for e in errs:
            print(e)
        if not errs:
            print("(nessuno)")


if __name__ == "__main__":
    run()
