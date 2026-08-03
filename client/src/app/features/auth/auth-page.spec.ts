import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthPage } from './auth-page';
import { CommitBand } from './commit-band';

/**
 * Every signed-out screen submits through the one `<form>` inside AuthPage, so if that
 * form's submit path breaks, all four of them break at once and the only symptom is the
 * page appearing to reload. It broke exactly once, bound as `(ngSubmit)` with no
 * `FormsModule` in the component's imports — a listener for a DOM event that never
 * fires. These two tests are here so it cannot happen quietly a second time.
 */
@Component({
  imports: [AuthPage, CommitBand],
  template: `
    <lf-auth-page title="בדיקה" (submitted)="submits = submits + 1">
      <lf-commit-band label="שלח" />
    </lf-auth-page>
  `,
})
class Host {
  submits = 0;
}

describe('AuthPage', () => {
  async function setup() {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const form = (fixture.nativeElement as HTMLElement).querySelector('form');
    if (!form) throw new Error('the page rendered no form');

    return { fixture, form };
  }

  /**
   * Dispatched rather than clicked: a submit the component fails to handle would navigate
   * the Karma page itself. `defaultPrevented` is the assertion that matters — it is the
   * difference between "signing in" and "the screen reloaded".
   */
  it('reports a submit to the screen and stops the browser navigating', async () => {
    const { fixture, form } = await setup();

    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    fixture.detectChanges();

    expect(fixture.componentInstance.submits).toBe(1);
    expect(event.defaultPrevented).toBeTrue();
  });

  /** The commit band is what the user actually presses, so it has to be the form's own. */
  it('holds the commit band as the submit control of that form', async () => {
    const { form } = await setup();
    const button = form.querySelector('button');

    expect(button?.getAttribute('type')).toBe('submit');
  });
});
