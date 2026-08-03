import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';
import { THEME_KEY, ThemeService } from './core/theme.service';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem(THEME_KEY);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('carries only the outlet and the global notification surfaces', () => {
    // The masthead, tabs and action band moved to Shell. The root has to stay bare so the
    // signed-out screens can render without any of it.
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.mast')).toBeNull();
    expect(compiled.querySelector('.tabs')).toBeNull();
    expect(compiled.querySelector('lf-toast-stack')).not.toBeNull();
    expect(compiled.querySelector('lf-alert-dialog')).not.toBeNull();
  });

  it('resolves the theme onto the document as it boots', () => {
    TestBed.createComponent(App);
    const theme = TestBed.inject(ThemeService);

    expect(theme.choice()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme.resolved());
  });
});
