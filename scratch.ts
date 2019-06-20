class Parent {
  protected foo() {
    return 'foo';
  }
}

class Child extends Parent {
  protected foo() {
    return 'bar';
  }
}
